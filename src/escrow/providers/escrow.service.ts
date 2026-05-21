import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionsService } from '../../transactions/providers/transactions.service';
import { WalletsService } from '../../wallets/providers/wallets.service';
import { DataSource, EntityManager } from 'typeorm';
import { OrderItem } from '../../orders/entities/orderItem.entity';
import { Escrow } from '../escrow.entity';
import { EscrowStatus } from '../enums/escrowStatus.enum';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { TransactionType } from '../../transactions/enums/transactionType.enum';
import { TransactionStatus } from '../../transactions/enums/transactionStatus.enum';
import { CurrencyConvertProvider } from '../../common/providers/currency-convert.provider';

@Injectable()
export class EscrowService {
  private COMMISSION_RATE = 0.1;

  constructor(
    private readonly dataSource: DataSource,
    private readonly walletService: WalletsService,
    private readonly txService: TransactionsService,
    private readonly currencyConvert: CurrencyConvertProvider,
  ) {}

  async releaseToAgent(orderItemId: number, manager?: EntityManager) {
    const runner = async (mgr: EntityManager) => {
      const oiRepo = mgr.getRepository(OrderItem);
      const escrowRepo = mgr.getRepository(Escrow);
      const walletRepo = mgr.getRepository(Wallet);

      // STEP 1: lock OrderItem row WITHOUT relations
      const lockedOI = await oiRepo.findOne({
        where: { id: orderItemId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedOI) throw new NotFoundException('Order item not found');

      // STEP 2: load full graph WITHOUT lock
      const oi = await oiRepo.findOne({
        where: { id: orderItemId },
        relations: [
          'order',
          'order.vendor',
          'order.vendor.user',
          'agent',
          'agent.user',
        ],
      });
      if (!oi) throw new NotFoundException('Order item not found');

      // Lock escrow row (idempotent)
      const escrow = await escrowRepo.findOne({
        where: { reference: `ESCROW-OI-${oi.id}` },
        lock: { mode: 'pessimistic_write' },
      });
      if (!escrow) throw new Error('Escrow not found');
      if (escrow.status !== EscrowStatus.HELD) return; // idempotent

      // Lock vendor and agent wallets (your walletService should lock safely)
      const vendorUserId = oi.order?.vendor?.user?.id;
      const agentUserId = oi.agent?.user?.id;

      if (!vendorUserId) throw new Error('Vendor user not found');
      if (!agentUserId) throw new Error('Agent user not found');

      const vendorWallet = await this.walletService.lockWallet(
        vendorUserId,
        mgr,
      );

      const agentWallet = await this.walletService.lockWallet(agentUserId, mgr);

      const feeKobo = this.currencyConvert.toKobo(Number(oi.cost));

      const commissionKobo = Math.round(feeKobo * this.COMMISSION_RATE);
      const agentEarningKobo = feeKobo - commissionKobo;

      // CRITICAL: normalize to numbers (avoid string concatenation)
      const vendorEscrowKobo = Number(vendorWallet.escrowBalance ?? 0);
      const agentAvailableKobo = Number(agentWallet.availableBalance ?? 0);

      if (vendorEscrowKobo < feeKobo) {
        throw new Error('Vendor escrow insufficient');
      }

      // Perform safe arithmetic
      vendorWallet.escrowBalance = vendorEscrowKobo - feeKobo;
      agentWallet.availableBalance = agentAvailableKobo + agentEarningKobo;

      await walletRepo.save([vendorWallet, agentWallet]);

      // Update escrow status
      escrow.status = EscrowStatus.RELEASED;
      await escrowRepo.save(escrow);

      // Log transaction for agent
      await this.txService.logTransaction(
        {
          user: oi.agent.user,
          type: TransactionType.CREDIT,
          amount: agentEarningKobo,
          description: `Escrow released for delivery item in order #${oi.order.reference}`,
          reference: `ESCROW-REL-${oi.id}`,
          status: TransactionStatus.SUCCESSFUL,
          order: oi.order,
          orderItem: oi,
        },
        mgr,
      );
    };

    if (manager) return runner(manager);
    return this.dataSource.transaction(runner);
  }

  async refundToVendor(orderItemId: number, manager?: EntityManager) {
    const runner = async (mgr: EntityManager) => {
      const oiRepo = mgr.getRepository(OrderItem);
      const escrowRepo = mgr.getRepository(Escrow);
      const walletRepo = mgr.getRepository(Wallet);

      // STEP 1: lock OrderItem row WITHOUT relations
      const lockedOI = await oiRepo.findOne({
        where: { id: orderItemId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedOI) throw new NotFoundException('Order item not found');

      // STEP 2: load graph WITHOUT lock
      const oi = await oiRepo.findOne({
        where: { id: orderItemId },
        relations: ['order', 'order.vendor', 'order.vendor.user'],
      });
      if (!oi) throw new NotFoundException('Order item not found');

      // Fetch associated Escrow with pessimistic lock
      const escrow = await escrowRepo.findOne({
        where: { reference: `ESCROW-OI-${oi.id}` },
        lock: { mode: 'pessimistic_write' },
      });
      if (!escrow) throw new Error('Escrow not found');
      if (escrow.status !== EscrowStatus.HELD) return; // idempotent

      // Lock vendor wallet (this must be lock-or-create and lock safely)
      const vendorUserId = oi.order?.vendor?.user?.id;
      if (!vendorUserId) throw new Error('Vendor user not found');

      const vendorWallet = await this.walletService.lockWallet(
        vendorUserId,
        mgr,
      );

      // Calculate fee in kobo
      const feeKobo = this.currencyConvert.toKobo(Number(oi.cost));

      // Normalize types (CRITICAL because bigint comes back as string)
      const escrowKobo = Number(vendorWallet.escrowBalance ?? 0);
      const availableKobo = Number(vendorWallet.availableBalance ?? 0);

      if (escrowKobo < feeKobo) {
        throw new Error('Vendor escrow insufficient');
      }

      // Safe arithmetic in KOBO only
      vendorWallet.escrowBalance = escrowKobo - feeKobo;
      vendorWallet.availableBalance = availableKobo + feeKobo;

      await walletRepo.save(vendorWallet);

      // Update escrow status
      escrow.status = EscrowStatus.REFUNDED;
      await escrowRepo.save(escrow);

      // Log transaction for vendor
      await this.txService.logTransaction(
        {
          user: oi.order.vendor.user,
          type: TransactionType.CREDIT,
          amount: feeKobo,
          description: `Escrow refunded for cancelled item in order #${oi.order.reference}`,
          reference: `ESCROW-REF-${oi.id}`,
          status: TransactionStatus.SUCCESSFUL,
          order: oi.order,
          orderItem: oi,
        },
        mgr,
      );
    };

    if (manager) return runner(manager);
    return this.dataSource.transaction(runner);
  }
}

import { Injectable } from '@nestjs/common';
import { PaystackService } from '../../paystack/providers/paystack.service';
import { User } from '../../users/user.entity';
import { DataSource } from 'typeorm';
import { VirtualAccount } from '../virtual-account.entity';
import { WalletFunding } from '../../wallets/entities/walletFunding.entity';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { Transaction } from '../../transactions/transaction.entity';
import { FundingStatus } from '../../wallets/enums/fundingStatus.enum';
import { TransactionType } from '../../transactions/enums/transactionType.enum';
import { TransactionStatus } from '../../transactions/enums/transactionStatus.enum';

@Injectable()
export class VirtualAccountService {
  constructor(
    private readonly paystack: PaystackService,
    private readonly dataSource: DataSource,
  ) {}

  async getOrCreateAgentAccount(user: User) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(VirtualAccount);

      // Check if already exists 
      let account = await repo.findOne({
        where: { userId: user.id },
      });

      if (account) return account;

      // Create Paystack customer
      const customer = await this.paystack.createCustomer(user);

      // Create DVA
      const dva = await this.paystack.createDedicatedAccount(
        customer.customer_code,
      );

      // Save
      account = repo.create({
        userId: user.id,
        customerCode: customer.customer_code,
        accountNumber: dva.account_number,
        bankName: dva.bank.name,
        accountName: dva.account_name,
        paystackDvaId: dva.id,
      });

      return repo.save(account);
    });
  }

  async handleSuccessfulCharge(data: any) {
    await this.dataSource.transaction(async (manager) => {
      const fundingRepo = manager.getRepository(WalletFunding);
      const walletRepo = manager.getRepository(Wallet);
      const transactionRepo = manager.getRepository(Transaction);
      const virtualAccountRepo = manager.getRepository(VirtualAccount);

      const reference = data.reference;

      // Idempotency check
      let funding = await fundingRepo.findOne({
        where: { reference },
      });

      if (funding && funding.status === FundingStatus.SUCCESS) {
        return; // already processed
      }

      // Identify agent via account number
      const accountNumber = data.authorization?.receiver_bank_account_number;

      const virtualAccount = await virtualAccountRepo.findOne({
        where: { accountNumber },
      });

      if (!virtualAccount) return;

      const userId = virtualAccount.userId;

      // Create funding record if not exists
      if (!funding) {
        funding = fundingRepo.create({
          userId,
          amount: data.amount,
          reference,
          paystackReference: data.reference,
          status: FundingStatus.PENDING,
          raw: data,
        });

        await fundingRepo.save(funding);
      }

      // Lock wallet row
      const wallet = await walletRepo.findOne({
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        return 'Wallet is unavailable';
      }

      // Credit ESCROW (not available balance!)
      const escrowKobo = Number(wallet.escrowBalance ?? 0);
      const amountKobo = Number(data.amount); // already kobo

      wallet.escrowBalance = escrowKobo + amountKobo;

      await walletRepo.save(wallet);

      // Create transaction
      await transactionRepo.save(
        transactionRepo.create({
          user: { id: userId } as any,
          type: TransactionType.CREDIT,
          amount: data.amount,
          status: TransactionStatus.SUCCESSFUL,
          reference,
          description: 'COD payment via virtual account',
        }),
      );

      // Mark funding success
      funding.status = FundingStatus.SUCCESS;
      await fundingRepo.save(funding);
    });
  }
}

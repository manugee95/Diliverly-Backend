import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';
import { WalletFunding } from '../entities/walletFunding.entity';
import { Repository, DataSource } from 'typeorm';
import { WalletsService } from './wallets.service';
import { TransactionsService } from 'src/transactions/providers/transactions.service';
import { FundingStatus } from '../enums/fundingStatus.enum';
import { Wallet } from '../entities/wallet.entity';
import { TransactionType } from 'src/transactions/enums/transactionType.enum';
import { TransactionStatus } from 'src/transactions/enums/transactionStatus.enum';
import { ReferenceProvider } from 'src/common/reference/reference.provider';
import { PaystackService } from 'src/paystack/providers/paystack.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WalletFundingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly paystack: PaystackService,
    private readonly reference: ReferenceProvider,
    private readonly walletService: WalletsService,
    private readonly txService: TransactionsService,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(WalletFunding)
    private readonly fundingRepo: Repository<WalletFunding>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    /**
     * Inject Config Service
     */
    private readonly config: ConfigService,
  ) {}

  /**
   * Core logic to finalize funding after Paystack verification.
   */

  // private async finalizeFunding(
  //   reference: string,
  //   amountPaidNaira: number,
  //   rawPayload: any,
  // ) {
  //   await this.dataSource.transaction(async (manager) => {
  //     const fundingRepo = manager.getRepository(WalletFunding);
  //     const walletRepo = manager.getRepository(Wallet);
  //     const userRepo = manager.getRepository(User);

  //     // 1) Lock funding row WITHOUT relations (avoid LEFT JOIN + FOR UPDATE)
  //     const funding = await fundingRepo.findOne({
  //       where: { reference },
  //       lock: { mode: 'pessimistic_write' },
  //     });

  //     if (!funding) return;
  //     if (funding.status === FundingStatus.SUCCESS) return;

  //     // 2) Use funding.userId directly (make sure your entity has userId column)
  //     const userId = funding.userId ?? funding.user?.id;
  //     if (!userId) throw new Error('Funding record has no userId');

  //     // 3) Lock wallet row separately
  //     const wallet = await walletRepo.findOne({
  //       where: { userId },
  //       lock: { mode: 'pessimistic_write' },
  //     });
  //     if (!wallet) throw new Error('Wallet not found');

  //     // Credit wallet (numeric)
  //     const newBalance = Number(wallet.availableBalance ?? 0) + amountPaidNaira;
  //     wallet.availableBalance = newBalance.toFixed(2);

  //     await walletRepo.save(wallet);

  //     // Update funding record
  //     funding.status = FundingStatus.SUCCESS;
  //     funding.paystackReference = reference;
  //     funding.raw = rawPayload;
  //     await fundingRepo.save(funding);

  //     // Log transaction
  //     const user = await userRepo.findOne({ where: { id: userId } });
  //     if (user) {
  //       await this.txService.logTransaction(
  //         {
  //           user,
  //           type: TransactionType.CREDIT,
  //           amount: amountPaidNaira,
  //           description: 'Wallet funding via Paystack',
  //           reference,
  //           status: TransactionStatus.SUCCESSFUL,
  //         },
  //         manager,
  //       );
  //     }
  //   });
  // }

  
  private async finalizeFunding(
    reference: string,
    amountPaidNaira: number,
    rawPayload: any,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const fundingRepo = manager.getRepository(WalletFunding);
      const walletRepo = manager.getRepository(Wallet);

      const funding = await fundingRepo.findOne({
        where: { reference },
        lock: { mode: 'pessimistic_write' },
      });

      if (!funding) return;

      // Strict state control
      if (funding.status !== FundingStatus.PENDING) return;

      // Prevent race condition
      funding.status = FundingStatus.PROCESSING;
      await fundingRepo.save(funding);

      const userId = funding.userId ?? funding.user?.id;
      if (!userId) return;

      // Validate amount
      if (Number(funding.amount) !== amountPaidNaira) {
        return;
      }

      // Validate currency
      if (rawPayload?.data?.currency !== 'NGN') {
        return;
      }

      const wallet = await walletRepo.findOne({
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) return;

      // Use KOBO (integer)
      const amountPaidKobo = Math.round(amountPaidNaira * 100);
      const currentBalanceKobo = Number(wallet.availableBalance ?? 0);
      const newBalanceKobo = currentBalanceKobo + amountPaidKobo;

      wallet.availableBalance = newBalanceKobo;
      await walletRepo.save(wallet);

      // ✅ Mark success
      funding.status = FundingStatus.SUCCESS;
      funding.paystackReference = reference;
      funding.raw = rawPayload;

      await fundingRepo.save(funding);

      // ✅ Log transaction
      await this.txService.logTransaction(
        {
          user: { id: userId } as User,
          type: TransactionType.CREDIT,
          amount: amountPaidNaira,
          description: 'Wallet funding via Paystack',
          reference,
          status: TransactionStatus.SUCCESSFUL,
        },
        manager,
      );
    });
  }

  /** Initiates wallet funding with Paystack */
  async initiateFunding(userId: number, amount: number) {
    // Validate amount
    if (amount <= 999)
      throw new BadRequestException('Minimum funding amount is 1000 Naira');

    // Fetch user
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    // Ensure wallet exists
    await this.walletService.getOrCreateWallet(userId);

    // Generate unique reference
    const reference = `FUND-${this.reference.generateTransactionRef()}`;

    // Create pending funding record (idempotency is by unique reference)
    await this.fundingRepo.save(
      this.fundingRepo.create({
        user: { id: userId },
        amount: amount,
        reference,
        status: FundingStatus.PENDING,
      }),
    );

    // Initialize Paystack transaction
    const init = await this.paystack.initializeTransaction({
      email: user.email,
      amountNaira: amount,
      reference,
      callback_url: `${this.config.get('APP_URL')}`,
      metadata: { userId },
    });

    return {
      reference,
      authorizationUrl: init.authorizationUrl,
    };
  }

  /**
   * Verify payment and fund wallet. (temporary method for dev, webhook is the source of truth in production)
   */
  async verifyAndFundWallet(reference: string) {
    const verification = await this.paystack.verifyTransaction(reference);

    const ok = verification?.status === true;
    const status = verification?.data?.status; // 'success'
    if (!ok || status !== 'success') {
      return { verified: false, reference, verification };
    }

    const amountPaidNaira = Number(verification?.data?.amount ?? 0) / 100;

    //This is the temporary replacement for webhook in dev
    await this.finalizeFunding(reference, amountPaidNaira, verification);

    return { verified: true, reference };
  }

  /**
   * Paystack webhook handler core logic.
   * Call this from controller after verifying signature.
   */
  async handlePaystackWebhook(event: any) {
    const eventType = event?.event;
    const data = event?.data;

    // We care about successful charges
    if (eventType !== 'charge.success') return;

    const reference = data?.reference;
    if (!reference) return;

    // Optional extra hardening: ensure status is success
    if (data?.status !== 'success') return;

    // amount is in kobo
    const amountPaidNaira = Number(data?.amount ?? 0) / 100;

    await this.finalizeFunding(reference, amountPaidNaira, event);
  }
}

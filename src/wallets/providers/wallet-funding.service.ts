import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../users/user.entity';
import { WalletFunding } from '../entities/walletFunding.entity';
import { Repository, DataSource } from 'typeorm';
import { WalletsService } from './wallets.service';
import { TransactionsService } from '../../transactions/providers/transactions.service';
import { FundingStatus } from '../enums/fundingStatus.enum';
import { Wallet } from '../entities/wallet.entity';
import { TransactionType } from '../../transactions/enums/transactionType.enum';
import { TransactionStatus } from '../../transactions/enums/transactionStatus.enum';
import { PaystackService } from '../../paystack/providers/paystack.service';
import { ConfigService } from '@nestjs/config';
import { CurrencyConvertProvider } from '../../common/providers/currency-convert.provider';
import { generateTransactionRef } from '../../common/utils/reference.util';
import { VirtualAccount } from '../../virtual-account/virtual-account.entity';

@Injectable()
export class WalletFundingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly paystack: PaystackService,
    private readonly walletService: WalletsService,
    private readonly txService: TransactionsService,
    private readonly currencyConvert: CurrencyConvertProvider,
    private readonly config: ConfigService,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(WalletFunding)
    private readonly fundingRepo: Repository<WalletFunding>,
  ) {}

  /**
   * Core logic to finalize funding after Paystack verification.
   */

  // private async finalizeFunding(
  //   reference: string,
  //   amountPaid: number,
  //   data: any,
  // ) {
  //   await this.dataSource.transaction(async (manager) => {
  //     const fundingRepo = manager.getRepository(WalletFunding);
  //     const walletRepo = manager.getRepository(Wallet);

  //     const funding = await fundingRepo.findOne({
  //       where: { reference },
  //       lock: { mode: 'pessimistic_write' },
  //     });

  //     if (!funding) return;

  //     // Idempotency + strict state control
  //     if (funding.status !== FundingStatus.PENDING) return;

  //     // Move to processing (prevents race conditions)
  //     funding.status = FundingStatus.PROCESSING;
  //     await fundingRepo.save(funding);

  //     const userId = funding.userId ?? funding.user?.id;
  //     if (!userId) return;

  //     // Validate amount (important security check)
  //     if (Number(funding.amount) !== amountPaid) {
  //       console.log(
  //         `Amount mismatch: expected ${funding.amount}, got ${amountPaid}`,
  //       );
  //       return;
  //     }

  //     // Validate currency using data (not rawPayload.data)
  //     if (data?.currency !== 'NGN') {
  //       return;
  //     }

  //     const wallet = await walletRepo.findOne({
  //       where: { userId },
  //       lock: { mode: 'pessimistic_write' },
  //     });

  //     if (!wallet) return;

  //     // Use KOBO (integer)
  //     const currentBalanceKobo = Number(wallet.availableBalance ?? 0);
  //     const amountPaidKobo = Number(funding.amount);
  //     const newBalanceKobo = currentBalanceKobo + amountPaidKobo;

  //     wallet.availableBalance = newBalanceKobo;
  //     await walletRepo.save(wallet);

  //     // Mark success
  //     funding.status = FundingStatus.SUCCESS;
  //     funding.paystackReference = data.reference; // better than using param blindly
  //     funding.raw = data; // store only relevant payload

  //     await fundingRepo.save(funding);

  //     // Log transaction
  //     await this.txService.logTransaction(
  //       {
  //         user: { id: userId } as User,
  //         type: TransactionType.CREDIT,
  //         amount: amountPaid,
  //         description: 'Wallet funding via Paystack',
  //         reference,
  //         status: TransactionStatus.SUCCESSFUL,
  //       },
  //       manager,
  //     );
  //   });
  // }

  private async finalizeFunding(
    reference: string,
    amountPaid: number,
    data: any,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const fundingRepo = manager.getRepository(WalletFunding);
      const walletRepo = manager.getRepository(Wallet);
      const virtualAccountRepo = manager.getRepository(VirtualAccount);

      // ---------------------------------------------------
      // CHECK IF THIS IS A VIRTUAL ACCOUNT TRANSFER
      // ---------------------------------------------------

      const receiverAccountNumber =
        data?.authorization?.receiver_bank_account_number;

      let virtualAccount: VirtualAccount | null = null;

      if (receiverAccountNumber) {
        virtualAccount = await virtualAccountRepo.findOne({
          where: {
            accountNumber: receiverAccountNumber,
          },
        });
      }

      const isVirtualAccountFunding = !!virtualAccount;

      // ---------------------------------------------------
      // FIND EXISTING FUNDING RECORD
      // ---------------------------------------------------

      let funding = await fundingRepo.findOne({
        where: { reference },
        lock: { mode: 'pessimistic_write' },
      });

      // ---------------------------------------------------
      // HANDLE VIRTUAL ACCOUNT FUNDING
      // ---------------------------------------------------

      if (!funding && isVirtualAccountFunding) {
        funding = fundingRepo.create({
          userId: virtualAccount!.userId,
          amount: amountPaid,
          reference,
          paystackReference: reference,
          status: FundingStatus.PENDING,
          raw: data,
        });

        await fundingRepo.save(funding);
      }

      // ---------------------------------------------------
      // IF STILL NO FUNDING RECORD → INVALID
      // ---------------------------------------------------

      if (!funding) {
        console.log(`Funding record not found for ${reference}`);
        return;
      }

      // ---------------------------------------------------
      // IDEMPOTENCY CHECK
      // ---------------------------------------------------

      if (
        funding.status === FundingStatus.SUCCESS ||
        funding.status === FundingStatus.PROCESSING
      ) {
        return;
      }

      // ---------------------------------------------------
      // MOVE TO PROCESSING
      // ---------------------------------------------------

      funding.status = FundingStatus.PROCESSING;
      await fundingRepo.save(funding);

      const userId = funding.userId ?? funding.user?.id;

      if (!userId) {
        funding.status = FundingStatus.FAILED;
        await fundingRepo.save(funding);
        return;
      }

      // ---------------------------------------------------
      // VALIDATE AMOUNT
      // ONLY FOR NORMAL CHECKOUT PAYMENTS
      // ---------------------------------------------------

      if (!isVirtualAccountFunding) {
        if (Number(funding.amount) !== Number(amountPaid)) {
          console.log(
            `Amount mismatch: expected ${funding.amount}, got ${amountPaid}`,
          );

          funding.status = FundingStatus.FAILED;
          await fundingRepo.save(funding);

          return;
        }
      }

      // ---------------------------------------------------
      // VALIDATE CURRENCY
      // ---------------------------------------------------

      if (data?.currency !== 'NGN') {
        funding.status = FundingStatus.FAILED;
        await fundingRepo.save(funding);

        return;
      }

      // ---------------------------------------------------
      // LOCK WALLET
      // ---------------------------------------------------

      const wallet = await walletRepo.findOne({
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        funding.status = FundingStatus.FAILED;
        await fundingRepo.save(funding);

        return;
      }

      // ---------------------------------------------------
      // CREDIT CORRECT BALANCE
      // ---------------------------------------------------

      const amountKobo = Number(amountPaid);

      if (isVirtualAccountFunding) {
        // CREDIT ESCROW
        wallet.escrowBalance = Number(wallet.escrowBalance ?? 0) + amountKobo;
      } else {
        // CREDIT AVAILABLE BALANCE
        wallet.availableBalance =
          Number(wallet.availableBalance ?? 0) + amountKobo;
      }

      await walletRepo.save(wallet);

      // ---------------------------------------------------
      // MARK SUCCESS
      // ---------------------------------------------------

      funding.status = FundingStatus.SUCCESS;
      funding.paystackReference = reference;
      funding.raw = data;

      await fundingRepo.save(funding);

      // ---------------------------------------------------
      // LOG TRANSACTION
      // ---------------------------------------------------

      await this.txService.logTransaction(
        {
          user: { id: userId } as User,
          type: TransactionType.CREDIT,
          amount: amountPaid,
          description: isVirtualAccountFunding
            ? 'Funding via virtual account'
            : 'Wallet funding via Paystack',
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
    const reference = `FUND-${generateTransactionRef()}`;

    // convert naira to kobo for storage
    const amountKobo = this.currencyConvert.toKobo(amount);

    // Create pending funding record (idempotency is by unique reference)
    await this.fundingRepo.save(
      this.fundingRepo.create({
        user: { id: userId },
        amount: amountKobo,
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
   * Paystack webhook handler core logic.
   * Call this from controller after verifying signature.
   */
  async handleSuccessfulCharge(data: any) {
    if (!data) return;

    const reference = data.reference;
    if (!reference) return;

    // Ensure it's actually successful
    if (data.status !== 'success') return;

    // Paystack sends amount in kobo → convert to naira
    const amountPaid = Number(data.amount ?? 0);

    await this.finalizeFunding(reference, amountPaid, data);
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Withdrawal } from '../withdrawal.entity';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { User } from '../../users/user.entity';
import { TransactionsService } from '../../transactions/providers/transactions.service';
import { ConfigService } from '@nestjs/config';
import { WithdrawalStatus } from '../enums/withdrawalStatus.enum';
import { TransactionType } from '../../transactions/enums/transactionType.enum';
import { TransactionStatus } from '../../transactions/enums/transactionStatus.enum';
import axios from 'axios';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { MailerService } from '../../mailer/providers/mailer.service';
import { CurrencyConvertProvider } from '../../common/providers/currency-convert.provider';
import { Transaction } from '../../transactions/transaction.entity';
import { generateTransactionRef } from '../../common/utils/reference.util';

@Injectable()
export class WithdrawalsService {
  constructor(
    /**
     * Inject User repository
     */
    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(Withdrawal)
    private withdrawalRepo: Repository<Withdrawal>,

    /**
     * Inject Transactions service
     */
    private transactionService: TransactionsService,

    /**
     * Inject DataSource
     */
    private dataSource: DataSource,

    /**
     * Inject Config service
     */
    private config: ConfigService,

    /**
     * Inject currency conversion provider
     */
    private readonly currencyConvert: CurrencyConvertProvider,

    /**
     * Injecting mail service
     */
    private readonly mailService: MailerService,
  ) {}

  /**
   * Method to notify a user of a withdarwal initiated
   */
  private async notifyUser(payload: {
    userEmail: string;
    orderReference: string;
    userName: string;
    accountName: string | undefined;
    accountNumber: string | undefined;
    bankName: string | undefined;
    amount: string;
  }) {
    try {
      await this.mailService.sendTemplate(
        payload.userEmail,
        'Your Withdrawal Has Been Initiated',
        'withdrawal-initiated',
        {
          orderReference: payload.orderReference,
          userName: payload.userName,
          accountName: payload.accountName,
          accountNumber: payload.accountNumber,
          bankName: payload.bankName,
          amount: payload.amount,
        },
      );
    } catch (error) {
      console.error('Failed to send user email:', error);
    }
  }

  private async logWithdrawalTransactions(
    user: User,
    withdrawal: Withdrawal,
    netAmount: number,
    fee: number,
    manager: EntityManager,
  ) {
    const basePayload = {
      user,
      reference: withdrawal.reference,
      status: TransactionStatus.PENDING,
      withdrawal,
    };

    await Promise.all([
      this.transactionService.logTransaction(
        {
          ...basePayload,
          type: TransactionType.WITHDRAWAL,
          amount: netAmount,
          description: `Withdrawal to bank account (${user.bank_account.accountNumber} ${user.bank_account.bankName})`,
        },
        manager,
      ),

      this.transactionService.logTransaction(
        {
          ...basePayload,
          type: TransactionType.WITHDRAWAL_FEE,
          amount: fee,
          description: `Withdrawal Fee`,
        },
        manager,
      ),
    ]);
  }

  async manualWithdrawal(userId: number, amount: number) {
    const FLAT_WITHDRAWAL_FEE = 50;

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    if (amount <= FLAT_WITHDRAWAL_FEE) {
      throw new BadRequestException(
        `Amount must be greater than ₦${FLAT_WITHDRAWAL_FEE}`,
      );
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['bank_account'],
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.bank_account) {
      throw new BadRequestException('Bank account is required');
    }

    const amountKobo = this.currencyConvert.toKobo(amount);
    const feeKobo = this.currencyConvert.toKobo(FLAT_WITHDRAWAL_FEE);
    const totalDebitKobo = amountKobo + feeKobo;

    const netAmountKobo = amountKobo - feeKobo;
    const netAmount = this.currencyConvert.toNaira(netAmountKobo);
    const formattedAmount = this.currencyConvert.formatNaira(amountKobo); 

    const reference = `WD-${generateTransactionRef()}`;

    let savedWithdrawal!: Withdrawal;

    // -------------------------------
    // 1. DB TRANSACTION (COMMIT FIRST)
    // -------------------------------
    await this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(Wallet);
      const withdrawalRepo = manager.getRepository(Withdrawal);

      const wallet = await walletRepo.findOne({
        where: { user: { id: userId } },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new Error('Wallet not found');

      const availableBalanceKobo = Number(wallet.availableBalance ?? 0);

      if (availableBalanceKobo < totalDebitKobo) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      // Debit wallet
      wallet.availableBalance = availableBalanceKobo - totalDebitKobo;
      await walletRepo.save(wallet);

      // Create withdrawal
      const withdrawal = withdrawalRepo.create({
        user: { id: userId } as any,
        amount: netAmountKobo,
        reference,
        status: WithdrawalStatus.PROCESSING,
      });

      savedWithdrawal = await withdrawalRepo.save(withdrawal);

      // Log transactions
      await this.logWithdrawalTransactions(
        user,
        savedWithdrawal,
        netAmountKobo,
        feeKobo,
        manager,
      );
    });

    // -------------------------------
    // 2. CALL PAYSTACK (AFTER COMMIT)
    // -------------------------------
    try {
      const transfer = await this.processPaystackTransfer(
        user,
        netAmount,
        savedWithdrawal.reference,
      );

      await this.withdrawalRepo.update(savedWithdrawal.id, {
        paystackTransferCode: transfer.transferCode,
      });

      // Send notification
      this.notifyUser({
        userEmail: user.email,
        userName: user.firstName,
        accountName: user.bank_account.accountName,
        accountNumber: user.bank_account.accountNumber,
        bankName: user.bank_account.bankName,
        amount: formattedAmount,
        orderReference: savedWithdrawal.reference,
      });

      return {
        success: true,
        message: 'Withdrawal initiated successfully',
        reference: savedWithdrawal.reference,
        status: WithdrawalStatus.PROCESSING,
      };
    } catch (error) {
      console.error('Paystack transfer failed:', error);

      // -------------------------------
      // 3. COMPENSATING TRANSACTION (REFUND)
      // -------------------------------
      await this.dataSource.transaction(async (manager) => {
        const walletRepo = manager.getRepository(Wallet);
        const withdrawalRepo = manager.getRepository(Withdrawal);

        // Refund wallet
        await walletRepo.increment(
          { user: { id: userId } },
          'availableBalance',
          totalDebitKobo,
        );

        // Mark withdrawal as failed
        await withdrawalRepo.update(savedWithdrawal.id, {
          status: WithdrawalStatus.FAILED,
        });

        // Optional: log reversal transaction
        await this.transactionService.logTransaction(
          {
            user,
            reference: savedWithdrawal.reference,
            type: TransactionType.REFUND,
            amount: totalDebitKobo,
            status: TransactionStatus.SUCCESSFUL,
            description: 'Withdrawal failed - amount refunded',
          },
          manager,
        );
      });

      throw new BadRequestException(
        'Withdrawal failed. Amount has been refunded.',
      );
    }
  }

  private async processPaystackTransfer(
    user: User,
    amount: number,
    reference: string,
  ) {
    const bank = user.bank_account;

    try {
      // Create transfer recipient
      const recipientRes = await axios.post(
        'https://api.paystack.co/transferrecipient',
        {
          type: 'nuban',
          name: bank.accountName,
          account_number: bank.accountNumber,
          bank_code: bank.bankCode,
          currency: 'NGN',
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.get('PAYSTACK_SECRET_KEY')}`,
          },
        },
      );

      const recipientCode = recipientRes.data.data.recipient_code;

      // Initiate transfer
      const transferRes = await axios.post(
        'https://api.paystack.co/transfer',
        {
          recipient: recipientCode,
          amount: amount * 100,
          reference,
          reason: 'Wallet Withdrawal',
          source: 'balance',
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.get('PAYSTACK_SECRET_KEY')}`,
          },
        },
      );

      const data = transferRes.data.data;

      if (data.status === 'otp') {
        return {
          transferCode: data.transfer_code,
          requiresOtp: true,
        };
      }

      return {
        transferCode: transferRes.data.data.transfer_code,
      };
    } catch (error) {
      console.log(error);

      throw new BadRequestException('Transfer initiation failed');
    }
  }

  async handleTransferSuccess(data: any) {
    await this.dataSource.transaction(async (manager) => {
      const withdrawalRepo = manager.getRepository(Withdrawal);
      const transactionRepo = manager.getRepository(Transaction);
      const walletRepo = manager.getRepository(Wallet);

      const reference = data.reference;

      const withdrawal = await withdrawalRepo.findOne({
        where: { reference },
      });

      if (!withdrawal) return;

      await walletRepo.findOne({
        where: { userId: withdrawal.user.id },
        lock: { mode: 'pessimistic_write' },
      });

      // Idempotency
      if (withdrawal.status === WithdrawalStatus.SUCCESS) return;

      withdrawal.status = WithdrawalStatus.SUCCESS;
      await withdrawalRepo.save(withdrawal);

      await transactionRepo.update(
        { reference },
        { status: TransactionStatus.SUCCESSFUL },
      );
    });
  }

  async handleTransferFailed(data: any) {
    const FLAT_WITHDRAWAL_FEE = 50;

    await this.dataSource.transaction(async (manager) => {
      const withdrawalRepo = manager.getRepository(Withdrawal);
      const walletRepo = manager.getRepository(Wallet);
      const transactionRepo = manager.getRepository(Transaction);

      const reference = data.reference;

      const withdrawal = await withdrawalRepo.findOne({
        where: { reference },
      });

      if (!withdrawal) return;

      await walletRepo.findOne({
        where: { userId: withdrawal.user.id },
        lock: { mode: 'pessimistic_write' },
      });

      // Prevent double refund
      if (
        withdrawal.status === WithdrawalStatus.FAILED ||
        withdrawal.status === WithdrawalStatus.REVERSED
      ) {
        return;
      }

      withdrawal.status = WithdrawalStatus.FAILED;
      await withdrawalRepo.save(withdrawal);

      // Refund wallet (IMPORTANT: stay consistent with units)
      const wallet = withdrawal.user.wallet;

      const currentBalanceKobo = Number(wallet.availableBalance ?? 0);
      const amountKobo = this.currencyConvert.toKobo(withdrawal.amount);
      const feeKobo = this.currencyConvert.toKobo(FLAT_WITHDRAWAL_FEE);
      const netAmountKobo = amountKobo + feeKobo;

      wallet.availableBalance = currentBalanceKobo + netAmountKobo;

      await walletRepo.save(wallet);

      await transactionRepo.update(
        { reference },
        {
          status: TransactionStatus.FAILED,
          description: 'Withdrawal failed. Amount refunded to wallet.',
        },
      );
    });
  }

  async handleTransferReversed(data: any) {
    const FLAT_WITHDRAWAL_FEE = 50;

    await this.dataSource.transaction(async (manager) => {
      const withdrawalRepo = manager.getRepository(Withdrawal);
      const walletRepo = manager.getRepository(Wallet);
      const transactionRepo = manager.getRepository(Transaction);

      const reference = data.reference;

      const withdrawal = await withdrawalRepo.findOne({
        where: { reference },
      });

      if (!withdrawal) return;

      await walletRepo.findOne({
        where: { userId: withdrawal.user.id },
        lock: { mode: 'pessimistic_write' },
      });

      // Prevent double refund
      if (
        withdrawal.status === WithdrawalStatus.FAILED ||
        withdrawal.status === WithdrawalStatus.REVERSED
      ) {
        return;
      }

      withdrawal.status = WithdrawalStatus.REVERSED;
      await withdrawalRepo.save(withdrawal);

      // Refund wallet (IMPORTANT: stay consistent with units)
      const wallet = withdrawal.user.wallet;

      const currentBalanceKobo = Number(wallet.availableBalance ?? 0);
      const amountKobo = this.currencyConvert.toKobo(withdrawal.amount);
      const feeKobo = this.currencyConvert.toKobo(FLAT_WITHDRAWAL_FEE);
      const netAmountKobo = amountKobo + feeKobo;

      wallet.availableBalance = currentBalanceKobo + netAmountKobo;

      await walletRepo.save(wallet);

      await transactionRepo.update(
        { reference },
        {
          status: TransactionStatus.FAILED,
          description: 'Withdrawal reversed. Amount refunded to wallet.',
        },
      );
    });
  }
}

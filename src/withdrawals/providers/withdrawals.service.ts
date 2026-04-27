import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Withdrawal } from '../withdrawal.entity';
import { Repository, DataSource } from 'typeorm';
import { User } from 'src/users/user.entity';
import { TransactionsService } from 'src/transactions/providers/transactions.service';
import { ConfigService } from '@nestjs/config';
import { WithdrawalStatus } from '../enums/withdrawalStatus.enum';
import { TransactionType } from 'src/transactions/enums/transactionType.enum';
import { TransactionStatus } from 'src/transactions/enums/transactionStatus.enum';
import axios from 'axios';
import { ReferenceProvider } from 'src/common/reference/reference.provider';
import * as crypto from 'crypto';
import { Agent } from 'src/agent/agent.entity';
import { Wallet } from 'src/wallets/entities/wallet.entity';
import { MailerService } from 'src/mailer/providers/mailer.service';
import { CurrencyConvertProvider } from 'src/common/providers/currency-convert.provider';
import { Transaction } from 'src/transactions/transaction.entity';

@Injectable()
export class WithdrawalsService {
  constructor(
    /**
     * Inject Withdrawal repository
     */
    @InjectRepository(Withdrawal)
    private withdrawalRepo: Repository<Withdrawal>,

    /**
     * Inject User repository
     */
    @InjectRepository(User)
    private userRepo: Repository<User>,

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
     * Injecting Reference Provider
     */
    private readonly reference: ReferenceProvider,

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
    amount: number;
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

  async manualWithdrawal(userId: number, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    // Fetch user + bank account (no wallet join needed here)
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['bank_account'],
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.bank_account) {
      throw new BadRequestException('Bank account is required');
    }

    return await this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(Wallet);
      const withdrawalRepo = manager.getRepository(Withdrawal);

      // Lock wallet row (avoid joins + safe against race conditions)
      const wallet = await walletRepo.findOne({
        where: { user: { id: userId } },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new Error('Wallet not found');

      // if (Number(wallet.availableBalance) < amount) {
      //   throw new BadRequestException('Insufficient wallet balance');
      // }

      // Deduct immediately
      const amountKobo = this.currencyConvert.toKobo(amount);

      // Normalize bigint-safe value
      const availableBalanceKobo = Number(wallet.availableBalance ?? 0);

      if (availableBalanceKobo < amountKobo) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      // Safe deduction in KOBO
      wallet.availableBalance = availableBalanceKobo - amountKobo;

      await walletRepo.save(wallet);

      // Create withdrawal record
      const withdrawal = withdrawalRepo.create({
        user: { id: userId } as any,
        amount,
        reference: `WD-${Date.now()}`,
        status: WithdrawalStatus.PROCESSING,
      });

      const savedWithdrawal = await withdrawalRepo.save(withdrawal);

      // Log transaction (PENDING because transfer not confirmed yet)
      await this.transactionService.logTransaction(
        {
          user,
          type: TransactionType.WITHDRAWAL,
          amount,
          description: `Withdrawal to bank account (${user.bank_account.accountNumber} ${user.bank_account.bankName})`,
          reference: this.reference.generateTransactionRef(),
          status: TransactionStatus.PENDING,
          withdrawal: savedWithdrawal,
        },
        manager,
      );

      // Initiate Paystack transfer
      // If this throws, the whole TX rolls back (wallet deduction is undone)
      const transfer = await this.processPaystackTransfer(
        user,
        amount,
        savedWithdrawal.reference,
      );

      savedWithdrawal.paystackTransferCode = transfer.transferCode;
      await withdrawalRepo.save(savedWithdrawal);

      // Notify user via email (don't await, we don't want to block the response)
      this.notifyUser({
        userEmail: user.email,
        userName: user.firstName,
        accountName: user.bank_account.accountName,
        accountNumber: user.bank_account.accountNumber,
        bankName: user.bank_account.bankName,
        amount,
        orderReference: savedWithdrawal.reference,
      });

      return {
        success: true,
        message: 'Withdrawal initiated successfully',
        reference: savedWithdrawal.reference,
        status: WithdrawalStatus.PROCESSING,
        transferCode: transfer.transferCode,
      };
    });
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
      console.error('PAYSTACK ERROR:', error.response?.data || error.message);
      throw new BadRequestException('Transfer initiation failed');
    }
  }

  async handleTransferSuccess(data: any) {
    await this.dataSource.transaction(async (manager) => {
      const withdrawalRepo = manager.getRepository(Withdrawal);
      const transactionRepo = manager.getRepository(Transaction);

      const reference = data.reference;

      const withdrawal = await withdrawalRepo.findOne({
        where: { reference },
        relations: ['user', 'user.wallet'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!withdrawal) return;

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
    await this.dataSource.transaction(async (manager) => {
      const withdrawalRepo = manager.getRepository(Withdrawal);
      const walletRepo = manager.getRepository(Wallet);
      const transactionRepo = manager.getRepository(Transaction);

      const reference = data.reference;

      const withdrawal = await withdrawalRepo.findOne({
        where: { reference },
        relations: ['user', 'user.wallet'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!withdrawal) return;

      // Prevent double refund
      if (
        withdrawal.status === WithdrawalStatus.FAILED ||
        withdrawal.status === WithdrawalStatus.REVERSED
      ) {
        return;
      }

      withdrawal.status = WithdrawalStatus.FAILED;
      await withdrawalRepo.save(withdrawal);

      // 💰 Refund wallet (IMPORTANT: stay consistent with units)
      const wallet = withdrawal.user.wallet;

      const currentBalanceKobo = Number(wallet.availableBalance ?? 0);
      const amountKobo = Number(withdrawal.amount);

      wallet.availableBalance = currentBalanceKobo + amountKobo;

      await walletRepo.save(wallet);

      await transactionRepo.update(
        { reference },
        {
          status: TransactionStatus.FAILED,
          description: 'Withdrawal failed. Amount refunded.',
        },
      );
    });
  }

  async handleTransferReversed(data: any) {
    await this.dataSource.transaction(async (manager) => {
      const withdrawalRepo = manager.getRepository(Withdrawal);
      const walletRepo = manager.getRepository(Wallet);
      const transactionRepo = manager.getRepository(Transaction);

      const reference = data.reference;

      const withdrawal = await withdrawalRepo.findOne({
        where: { reference },
        relations: ['user', 'user.wallet'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!withdrawal) return;

      if (withdrawal.status === WithdrawalStatus.REVERSED) return;

      withdrawal.status = WithdrawalStatus.REVERSED;
      await withdrawalRepo.save(withdrawal);

      const wallet = withdrawal.user.wallet;

      const currentBalanceKobo = Number(wallet.availableBalance ?? 0);
      const amountKobo = Number(withdrawal.amount);

      wallet.availableBalance = currentBalanceKobo + amountKobo;

      await walletRepo.save(wallet);

      await transactionRepo.update(
        { reference },
        {
          status: TransactionStatus.FAILED,
          description: 'Withdrawal reversed. Amount refunded.',
        },
      );
    });
  }
}

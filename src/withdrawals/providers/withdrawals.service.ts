import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Withdrawal } from '../withdrawal.entity';
import { Repository, DataSource } from 'typeorm';
import { Agent } from 'src/agent/entities/agent.entity';
import { User } from 'src/users/user.entity';
import { TransactionsService } from 'src/transactions/providers/transactions.service';
import { ConfigService } from '@nestjs/config';
import { WithdrawalStatus } from '../enums/withdrawalStatus.enum';
import { TransactionType } from 'src/transactions/enums/transactionType.enum';
import { TransactionStatus } from 'src/transactions/enums/transactionStatus.enum';
import axios from 'axios';
import { ReferenceProvider } from 'src/common/reference/reference.provider';
import * as crypto from 'crypto';

@Injectable()
export class WithdrawalsService {
  constructor(
    /**
     * Inject Withdrawal repository
     */
    @InjectRepository(Withdrawal)
    private withdrawalRepo: Repository<Withdrawal>,

    /**
     * Inject Agent repository
     */
    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,

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
  ) {}

  async manualWithdrawal(userId: number, amount: number) {
    const agent = await this.agentRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user', 'bank_account'],
    });

    if (!agent) throw new NotFoundException('Agent not found');
    if (!agent.bank_account)
      throw new BadRequestException('Bank account is required');

    const user = agent.user;
    if (Number(user.walletBalance) < amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    return await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const withdrawalRepo = manager.getRepository(Withdrawal);

      // Deduct wallet
      user.walletBalance = Number(user.walletBalance) - amount;
      await userRepo.save(user);

      // Create withdrawal
      const withdrawal = withdrawalRepo.create({
        agent,
        amount,
        reference: `WD-${Date.now()}`,
        status: WithdrawalStatus.PROCESSING,
      });

      const savedWithdrawal = await withdrawalRepo.save(withdrawal);

      // Transaction Record
      await this.transactionService.logTransaction(
        {
          user,
          type: TransactionType.WITHDRAWAL,
          amount,
          description: `Withdrawal to bank account (${agent.bank_account.accountNumber} ${agent.bank_account.bankName})`,
          reference: this.reference.generateTransactionRef(),
          status: TransactionStatus.PENDING,
          withdrawal: savedWithdrawal,
        },
        manager,
      );

      // Paystack Transfer
      const transfer = await this.processPaystackTransfer(
        agent,
        amount,
        withdrawal.reference,
      );

      savedWithdrawal.paystackTransferCode = transfer.transferCode;
      await withdrawalRepo.save(savedWithdrawal);

      return {
        success: true,
        message: 'Withdrawal initiated successfully',
        reference: savedWithdrawal.reference,
        status: WithdrawalStatus.PROCESSING,
      };
    });
  }

  private async processPaystackTransfer(
    agent: Agent,
    amount: number,
    reference: string,
  ) {
    // Create transfer recipient
    try {
      const response = await axios.post(
        'https://api.paystack.co/transferrecipient',
        {
          type: 'nuban',
          name: agent.bank_account.accountName,
          account_number: agent.bank_account.accountNumber,
          bank_code: agent.bank_account.bankCode,
          currency: 'NGN',
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.get('PAYSTACK_SECRET_KEY')}`,
          },
        },
      );

      const recipientCode = response.data.data.recipient_code;

      // Initiate transfer
      const transfer = await axios.post(
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

      return { transferCode: transfer.data.data.transfer_code };
    } catch (error) {
      console.log('PAYSTACK ERROR:', error.response?.data);
      throw error;
    }
  }

  async handlePaystackWebhook(
    signature: string,
    payload: any,
    rawBody: Buffer,
  ) {
    const secret = this.config.get('PAYSTACK_SECRET_KEY');

    // Correct signature hash (MUST USE RAW BODY)
    const hash = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const event = payload.event;
    const data = payload.data;

    const reference = data.reference || data.transfer_code;
    if (!reference) return;

    const withdrawal = await this.withdrawalRepo.findOne({
      where: { reference },
      relations: ['agent'],
    });

    if (!withdrawal) return;

    switch (event) {
      case 'transfer.success':
        await this.markWithdrawalSuccessful(withdrawal, data);
        break;
      case 'transfer.failed':
        await this.markWithdrawalFailed(withdrawal, data);
        break;
      case 'transfer.reversed':
        await this.markWithdrawalReversed(withdrawal, data);
        break;
      default:
        return { status: 'ignored' };
    }

    return { status: 'processed' };
  }

  private async markWithdrawalSuccessful(withdrawal: Withdrawal, data: any) {
    withdrawal.status = WithdrawalStatus.SUCCESS;

    await this.withdrawalRepo.save(withdrawal);

    // Update transaction status
    await this.transactionService.updateTransaction(data.reference, {
      status: TransactionStatus.SUCCESSFUL,
    });
  }

  private async markWithdrawalFailed(withdrawal: Withdrawal, data: any) {
    withdrawal.status = WithdrawalStatus.FAILED;
    await this.withdrawalRepo.save(withdrawal);

    // Refund wallet
    withdrawal.agent.user.walletBalance += withdrawal.amount;
    await this.userRepo.save(withdrawal.agent.user);

    // Update transaction status
    await this.transactionService.updateTransaction(data.reference, {
      status: TransactionStatus.FAILED,
      description: `Withdrawal failed. Amount refunded to wallet.`,
    });
  }

  private async markWithdrawalReversed(withdrawal: Withdrawal, data: any) {
    withdrawal.status = WithdrawalStatus.REVERSED;
    await this.withdrawalRepo.save(withdrawal);

    // Refund wallet
    withdrawal.agent.user.walletBalance += withdrawal.amount;
    await this.userRepo.save(withdrawal.agent.user);

    // Update transaction status
    await this.transactionService.updateTransaction(data.reference, {
      status: TransactionStatus.FAILED,
      description: `Withdrawal reversed. Amount refunded to wallet.`,
    });
  }
}

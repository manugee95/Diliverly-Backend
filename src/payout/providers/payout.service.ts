import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import axios from 'axios';
import { User } from 'src/users/user.entity';
import { Agent } from 'src/agent/entities/agent.entity';
import { Agent_Bank_Account } from 'src/agent/entities/agent_bank_account.entity';
import { TransactionsService } from 'src/transactions/providers/transactions.service';
import { TransactionType } from 'src/transactions/enums/transactionType.enum';
import { TransactionStatus } from 'src/transactions/enums/transactionStatus.enum';
import { Transaction } from 'src/transactions/transaction.entity';
import { ConfigService } from '@nestjs/config';
import { ReferenceProvider } from 'src/common/reference/reference.provider';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    /**
     * Injecting User Repository
     */
    @InjectRepository(User)
    private userRepo: Repository<User>,

    /**
     * Injecting Agent Repository
     */
    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,

    /**
     * Injecting Transaction Repository
     */
    @InjectRepository(Transaction)
    private txRepo: Repository<Transaction>,

    /**
     * Injecting Transaction Service
     */
    private readonly transactionService: TransactionsService,

    /**
     * Injecting Reference Provider
     */
    private readonly reference: ReferenceProvider,

    /**
     * Inject Config Service
     */
    private readonly config: ConfigService,
  ) {}

  /**
   * Run auto payout daily
   */
  @Cron(CronExpression.MONDAY_TO_FRIDAY_AT_7AM)
  async autoPayoutAgents() {
    this.logger.log('Running Auto Payout Job...');

    const agents = await this.agentRepo.find({
      relations: ['user', 'bank_account'],
      where: {
        user: {
          walletBalance: MoreThan(0),
        },
      },
    });

    if (!agents.length) {
      this.logger.log('No agents eligible for auto payout');
      return;
    }

    for (const agent of agents) {
      try {
        await this.processPayout(agent);
      } catch (err) {
        this.logger.error(
          `Payout failed for Agent ${agent.id}: ${err.message}`,
        );
      }
    }
  }

  /**
   * Handle payout for one agent
   */
  async processPayout(agent: Agent) {
    const user = agent.user;

    if (user.walletBalance <= 0) {
      throw new BadRequestException('No available wallet balance');
    }

    const bank = agent.bank_account;

    if (!bank || !bank.accountNumber || !bank.bankCode) {
      throw new BadRequestException('Agent bank account incomplete');
    }

    const amount = Number(user.walletBalance);

    // 1) Log DEBIT transaction FIRST
    const transaction = await this.transactionService.logTransaction({
      user,
      type: TransactionType.DEBIT,
      amount,
      description: 'Automatic payout to agent bank account',
      reference: this.reference.generateTransactionRef(),
    });

    // 2) Update user wallet balance → 0
    user.walletBalance = 0;
    await this.userRepo.save(user);

    // 3) Initiate Paystack transfer
    const transfer = await this.sendToPaystack(bank, amount, transaction.id);

    // 4) Update transaction status → SUCCESS
    transaction.status = TransactionStatus.SUCCESSFUL;
    transaction.reference = transfer.reference;
    await this.txRepo.update(transaction.id, {
      status: TransactionStatus.SUCCESSFUL,
      reference: transfer.reference,
    });

    return transfer;
  }

  /**
   * Send money to Paystack
   */
  private async sendToPaystack(
    bank: Agent_Bank_Account,
    amount: number,
    transactionId: number,
  ) {
    // Create transfer recipient
    const recipient = await axios.post(
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

    // Initiate transfer
    const transfer = await axios.post(
      'https://api.paystack.co/transfer',
      {
        source: 'balance',
        amount: amount * 100,
        recipient: recipient.data.data.recipient_code,
        reason: `Agent Wallet Payout - TX-${transactionId}`,
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.get('PAYSTACK_SECRET_KEY')}`,
        },
      },
    );

    return {
      status: transfer.data.data.status,
      reference: transfer.data.data.reference,
    };
  }
}

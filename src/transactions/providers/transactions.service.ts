// transactions/transactions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Transaction } from '../transaction.entity';
import { OrderItem } from 'src/orders/entities/orderItem.entity';
import { User } from 'src/users/user.entity';
import { OrderStatus } from 'src/orders/enums/orderStatus.enum';
import { CreateTransactionDto } from '../dtos/create-transaction.dto';
import { TransactionStatus } from '../enums/transactionStatus.enum';

@Injectable()
export class TransactionsService {
  constructor(
    /**
     * Inject Transaction repository
     */
    @InjectRepository(Transaction)
    private readonly transRepo: Repository<Transaction>,

    /**
     * Inject OrderItem repository
     */
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,

    /**
     * Inject User repository
     */
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // Called internally: logs a transaction (payout/refund/withdraw)
  async logTransaction(dto: CreateTransactionDto, manager?: EntityManager) {
    const {
      user,
      type,
      amount,
      description,
      orderItem,
      reference,
      status,
    } = dto;

    const repo = manager ? manager.getRepository(Transaction) : this.transRepo;

    const tx = repo.create({
      user,
      type,
      amount,
      description,
      orderItem,
      status,
      reference,
    });

    return await repo.save(tx);
  }

  async updateTransaction(
    reference: string,
    updates: Partial<{
      status: TransactionStatus;
      description: string;
      amount: number;
      orderItem: any;
      balanceAfter: number;
    }>,
    manager?: EntityManager,
  ) {
    const repo = manager ? manager.getRepository(Transaction) : this.transRepo;

    // Find transaction
    const tx = await repo.findOne({
      where: { reference },
      relations: ['user', 'orderItem'],
    });

    if (!tx) {
      throw new NotFoundException(
        `Transaction with reference ${reference} not found`,
      );
    }

    // Apply the updates safely
    if (updates.status) tx.status = updates.status;
    if (updates.description) tx.description = updates.description;
    if (updates.amount) tx.amount = updates.amount;
    if (updates.orderItem) tx.orderItem = updates.orderItem;

    // Save and return updated record
    return await repo.save(tx);
  }

  // Wallet Overview: available, pending, next payout date
  async getWalletOverview(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['agent'],
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get Available balance
    const availableBalance = Number(user.walletBalance);

    // Get Pending balance
    let pendingBalance = 0;

    if (user.agent) {
      const pendingItems = await this.orderItemRepo.find({
        where: {
          agent: { id: user.agent.id },
          status: OrderStatus.IN_PROGRESS,
        },
      });

      pendingBalance = pendingItems.reduce(
        (sum, oi) => sum + Number(oi.cost),
        0,
      );
    }

    return {
      availableBalance,
      pendingBalance,
    };
  }

  // Nigerian payout: next business day
  private calculatePayoutDate(): Date {
    const now = new Date();
    let payout = new Date(now);
    payout.setDate(payout.getDate() + 1); // +24 hours

    // If weekend, move to Monday
    if (payout.getDay() === 6) payout.setDate(payout.getDate() + 2); // Saturday → Monday
    if (payout.getDay() === 0) payout.setDate(payout.getDate() + 1); // Sunday → Monday

    return payout;
  }
}

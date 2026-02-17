// transactions/transactions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Transaction } from '../transaction.entity';
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
  ) {}

  // Called internally: logs a transaction 
  async logTransaction(dto: CreateTransactionDto, manager?: EntityManager) {
    const {
      user,
      type,
      amount,
      description,
      order,
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
      order,
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
}

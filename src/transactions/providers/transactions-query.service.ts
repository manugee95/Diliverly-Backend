import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider';
import { Transaction } from '../transaction.entity';
import { Repository } from 'typeorm';
import { GetTransactionsDto } from '../dtos/get-transactions.dto';
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface';

@Injectable()
export class TransactionsQueryService {
  constructor(
    /**
     * Inject Pagination Provider
     */
    private readonly paginationProvider: PaginationProvider,

    /**
     * Inject Transaction repository
     */
    @InjectRepository(Transaction)
    private readonly transRepo: Repository<Transaction>,
  ) {}

  // Get paginated transaction history
  async getUserTransactions(
    userId: number,
    transactionQuery: GetTransactionsDto,
  ): Promise<Paginated<Transaction>> {
    const transactions = await this.paginationProvider.paginateQuery(
      {
        page: transactionQuery.page || 1,
        limit: transactionQuery.limit || 10,
      },
      this.transRepo,
      {
        where: { user: { id: userId } },
        order: { createdAt: 'DESC' },
      },
    );

    return transactions;
  }
}

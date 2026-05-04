import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationProvider } from '../../common/pagination/providers/pagination.provider';
import { Transaction } from '../transaction.entity';
import { Repository } from 'typeorm';
import { GetTransactionsDto } from '../dtos/get-transactions.dto';
import { Paginated } from '../../common/pagination/interfaces/paginated.interface';
import { CurrencyConvertProvider } from '../../common/providers/currency-convert.provider';

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
    private readonly currencyConvert: CurrencyConvertProvider
  ) {}

  // Get paginated transaction history for a user
  async getUserTransactions(
    userId: number,
    transactionQuery: GetTransactionsDto,
  ): Promise<Paginated<any>> {
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

    // Format amounts to Naira
    const formattedData = transactions.data.map((tx) => ({
      ...tx,
      amount: this.currencyConvert.formatNaira(tx.amount),
    }));

    return {
      ...transactions,
      data: formattedData,
    };
  }
}

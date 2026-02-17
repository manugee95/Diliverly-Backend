import { Controller, Get, Query, Req } from '@nestjs/common';
import { TransactionsService } from './providers/transactions.service';
import { GetTransactionsDto } from './dtos/get-transactions.dto';
import { TransactionsQueryService } from './providers/transactions-query.service';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

@Controller('transactions')
export class TransactionsController {
  constructor(
    /**
     * Inject Transactions Service
     */
    private readonly transactionsService: TransactionsService,

    /**
     * Inject Transactions Query Service
     */
    private readonly transactionsQueryService: TransactionsQueryService,
  ) {}

  @ApiOperation({
    summary: 'Fetches a list of transactions for the logged in user',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions fetched successfully based on the query',
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
    description: 'The number of entries returned per query',
    example: 10,
  })
  @ApiQuery({
    name: 'page',
    type: 'number',
    required: false,
    description: 'The page number returned per query',
    example: 1,
  })
  @Get()
  async getTransactions(@Req() req, @Query() dto: GetTransactionsDto) {
    return this.transactionsQueryService.getUserTransactions(req.user.id, dto);
  }
}

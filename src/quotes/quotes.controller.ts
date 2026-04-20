import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { QuotesService } from './providers/quotes.service';
import { CreateQuoteDto } from './dtos/create-quote.dto';
import { GetQuoteDto } from './dtos/get-quote.dto';
import { VendorGuard } from 'src/auth/guards/roles/vendor.guard';
import { AgentGuard } from 'src/auth/guards/roles/agent.guard';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { QuotePaymentService } from './providers/quote-payment.service';

@Controller('quotes')
export class QuotesController {
  constructor(
    /**
     * Injecting Quotes Service
     */
    private readonly quotesService: QuotesService,

    /**
     * Inject Quote Payment Service
     */
    private readonly quotePaymentService: QuotePaymentService,
  ) {}

  /**
   * Endpoint to send a quote
   */
  @ApiOperation({
    summary: 'Send a quote for a delivery request',
  })
  @ApiResponse({
    status: 200,
    description: 'Quote sent successfully.',
  })
  @UseGuards(AgentGuard)
  @Post()
  public async sendQuote(@Req() req, @Body() dto: CreateQuoteDto) {
    const userId = req.user.id;
    return this.quotesService.createQuote(userId, dto);
  }

  /**
   * Endpoint to get quotes submitted by an agent
   */
  @ApiOperation({
    summary: 'Get quotes submitted by an agent',
  })
  @ApiResponse({
    status: 200,
    description: 'Quotes retrieved successfully.',
  })
  @ApiQuery({
    name: 'status',
    type: 'string',
    required: false,
    description: 'The status of the quotes to retrieve',
    example: 'pending',
  })
  @UseGuards(AgentGuard)
  @Get('/agent')
  public async getQuotesForAgent(@Req() req, @Query() dto: GetQuoteDto) {
    const userId = req.user.id;
    return this.quotesService.getQuotesForAgent(userId, dto);
  }

  /**
   * Endpoint to get quotes for a delivery request
   */
  @ApiOperation({
    summary: 'Get quotes for a delivery request by a vendor',
  })
  @ApiResponse({
    status: 200,
    description: 'Quotes retrieved successfully.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    required: false,
    description: 'The ID of the delivery request',
    example: 5,
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
  @UseGuards(VendorGuard)
  @Get('/:requestId')
  public async getQuotesForRequest(
    @Req() req,
    @Param('requestId') requestId: number,
    @Query() dto: GetQuoteDto,
  ) {
    const userId = req.user.id;
    return this.quotesService.getQuotesForRequest(userId, requestId, dto);
  }

  /**
   * Endpoint to get a single quote by ID
   */
  @ApiOperation({
    summary: 'Get a single quote by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Quote retrieved successfully.',
  })
  @Get('/:quoteId')
  public async getQuoteById(@Req() req, @Param('quoteId') quoteId: number) {
    const userId = req.user.id;
    return this.quotesService.getQuoteById(userId, quoteId);
  }

  /**
   * Endpoint to accept a quote
   */
  @ApiOperation({
    summary: 'Accept a quote for a delivery request',
  })
  @ApiResponse({
    status: 200,
    description: 'Quote accepted successfully.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    required: false,
    description: 'The ID of the quote to accept',
    example: 5,
  })
  @UseGuards(VendorGuard)
  @Post('/:quoteId')
  public async acceptQuote(@Req() req, @Param('quoteId') quoteId: number) {
    const userId = req.user.id;
    return this.quotesService.acceptQuote(userId, quoteId);
  }

  /**
   * Endpoint to make payment for accepted quote
   */
  @ApiOperation({
    summary: 'Make payment for an accepted quote',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    required: false,
    description: 'The ID of the request associated with the accepted quote',
    example: 5,
  })
  @UseGuards(VendorGuard)
  @Post('/:requestId/pay')
  public async payAcceptedQuote(
    @Req() req,
    @Param('requestId') requestId: number,
  ) {
    const userId = req.user.id;
    return this.quotePaymentService.payAcceptedQuoteWithWallet(
      userId,
      requestId,
    );
  }
}

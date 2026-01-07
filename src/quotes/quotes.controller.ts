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
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/users/enums/userRole.enum';
import { GetQuoteDto } from './dtos/get-quote.dto';
import { VendorGuard } from 'src/auth/guards/roles/vendor.guard';
import { AgentGuard } from 'src/auth/guards/roles/agent.guard';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

@Controller('quotes')
export class QuotesController {
  constructor(
    /**
     * Injecting Quotes Service
     */
    private readonly quotesService: QuotesService,
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
   * Endpoint to get quotes for a delivery request
   */
  @ApiOperation({
    summary: 'Get quotes for a delivery request',
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
}

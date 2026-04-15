import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { BankAccountService } from './providers/bank-account.service';
import { CreateBankAccountDto } from './dtos/create-bank-account.dto';
import { PatchBankAccountDto } from './dtos/patch-bank-account.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('bank-account')
export class BankAccountController {
  constructor(
    /**
     * Inject BankAccountService
     */
    private readonly bankAccountService: BankAccountService,
  ) {}

  /**
   * Endpoint to add a bank account for a user
   */
  @ApiOperation({
    summary: 'Add a bank account for the user',
  })
  @ApiResponse({
    status: 201,
    description: 'Bank account added successfully.',
  })
  @Post()
  async addBankAccount(@Req() req, @Body() dto: CreateBankAccountDto) {
    return this.bankAccountService.addBankAccount(req.user.id, dto);
  }

  /**
   * Endpoint to get a user's bank account details
   */
  @ApiOperation({
    summary: 'Get the user\'s bank account details',
  })
  @ApiResponse({
    status: 201,
    description: 'Bank account retrieved successfully.',
  })
  @Get()
  async getBankAccount(@Req() req) {
    return this.bankAccountService.getBankAccount(req.user.id);
  }

  /**
   * Endpoint to update a user's bank account details
   */
  @ApiOperation({
    summary: 'Update the user\'s bank account details',
  })
  @ApiResponse({
    status: 201,
    description: 'Bank account updated successfully.',
  })
  @Patch()
  async updateBankAccount(@Req() req, @Body() dto: PatchBankAccountDto) {
    return this.bankAccountService.updateBankAccount(req.user.id, dto);
  }

  /**
   * Endpoint to get all banks supported by Paystack
   */
  @ApiOperation({
    summary: 'Get all banks supported by Paystack',
  })
  @ApiResponse({
    status: 201,
    description: 'List of supported banks retrieved successfully.',
  })
  @Get('banks')
  async getAllBanks() {
    return this.bankAccountService.getAllBanks();
  }
}

import { Controller, Req, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { VirtualAccountService } from './providers/virtual-account.service';
import { AgentGuard } from '../auth/guards/roles/agent.guard';
import { User } from '../users/user.entity';

@Controller('virtual-account')
export class VirtualAccountController {
  constructor(private readonly virtualAccountService: VirtualAccountService) {}

  @UseGuards(AgentGuard)
  @Get('me')
  async getVirtualAccount(@Req() req) {
    const user = req.user as User;

    // Ensure only agents can access this
    if (user.isAgent === false) {
      throw new ForbiddenException('Only agents can have a virtual account');
    }

    const account =
      await this.virtualAccountService.getOrCreateAgentAccount(user);

    return {
      status: 'success',
      message: 'Virtual account retrieved successfully',
      data: {
        accountNumber: account.accountNumber,
        bankName: account.bankName,
        accountName: account.accountName,
      },
    };
  }
}

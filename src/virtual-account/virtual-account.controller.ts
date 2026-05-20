import {
  Controller,
  Req,
  Get,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { VirtualAccountService } from './providers/virtual-account.service';
import { AgentGuard } from '../auth/guards/roles/agent.guard';
import { User } from '../users/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundError } from 'rxjs';

@Controller('virtual-account')
export class VirtualAccountController {
  constructor(
    private readonly virtualAccountService: VirtualAccountService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @UseGuards(AgentGuard)
  @Get('me')
  async getVirtualAccount(@Req() req) {
    const userId = req.user.id;

    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

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

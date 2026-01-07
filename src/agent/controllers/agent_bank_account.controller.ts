import { Body, Controller, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AgentBankAccountService } from '../providers/agent_bank_account.service';
import { CreateAgentBankAccountDto } from '../dtos/create-agent-bank-account.dto';
import { PatchAgentBankAccountDto } from '../dtos/patch-agent-bank-account.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/users/enums/userRole.enum';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';

@Controller('agent-bank-account')
export class AgentBankAccountController {
  constructor(
    /**
     * Inject AgentBankAccount Service
     */
    private readonly agentBankAccountService: AgentBankAccountService,
  ) {}

  /**
   * Endpoint to add bank account for an agent
   */
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT)
  @Post('/:agentId')
  public addBankAccount(
    @Param('agentId') agentId: number,
    @Body() dto: CreateAgentBankAccountDto,
  ) {
    return this.agentBankAccountService.addBankAccount(agentId, dto);
  }

  /**
   * Endpoint to update bank account for an agent
   */
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT)
  @Patch('/:agentId')
  public updateBankAccount(
    @Param('agentId') agentId: number,
    @Body() dto: PatchAgentBankAccountDto,
  ) {
    return this.agentBankAccountService.updateBankAccount(agentId, dto);
  }
}

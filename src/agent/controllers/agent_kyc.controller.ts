import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AgentKycService } from '../providers/agent_kyc.service';
import { CreateAgentKycDto } from '../dtos/create-agent-kyc.dto';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/users/enums/userRole.enum';

@Controller('agent-kyc')
export class AgentKycController {
  constructor(
    /**
     * Inject AgentKyc Service
     */
    private readonly agentKycService: AgentKycService,
  ) {}

  /**
   * Endpoint to add Agent KYC
   */
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT)
  @Post('/:agentId')
  public addAgentKyc(
    @Body() dto: CreateAgentKycDto,
    @Param('agentId') agentId: number,
  ) {
    return this.agentKycService.addAgentKyc(agentId, dto);
  }
}

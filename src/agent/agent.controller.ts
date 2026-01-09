import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AgentService } from './providers/agent.service';
import { CreateAgentDto } from './dtos/create-agent.dto';
import { GetAgentsDto } from './dtos/get-agents.dto';
import { AuthenticationGuard } from 'src/auth/guards/authentication/authentication.guard';
import { AgentGuard } from 'src/auth/guards/roles/agent.guard';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

@Controller('agent')
export class AgentController {
  constructor(
    /**
     * Inject Agent Service
     */
    private readonly agentService: AgentService,
  ) {}

  /**
   * Endpoint to update agent profile
   */
  @ApiOperation({
    summary: 'Update agent profile',
  })
  @ApiResponse({
    status: 201,
    description: 'Agent profile updated successfully.',
  })
  @UseGuards(AgentGuard)
  @Patch('/profile')
  public updateAgentProfile(@Body() dto: CreateAgentDto, @Req() req) {
    const userId = req.user.id;
    return this.agentService.updateAgentProfile(userId, dto);
  }

  /**
   * Endpoint to get agent profile
   */
  @ApiOperation({
    summary: 'Get Agent profile',
  })
  @ApiResponse({
    status: 201,
    description: 'Agent profile fetched successfully.',
  })
  @UseGuards(AgentGuard)
  @Get('/profile')
  public getAgentProfile(@Req() req) {
    const userId = req.user?.id;
    return this.agentService.getAgentProfile(userId);
  }

  /**
   * Endpoint to get all agents or a specific agent by id
   */
  @ApiOperation({
    summary: 'Get all agents or a specific agent by id',
  })
  @ApiResponse({
    status: 201,
    description: 'Agent profile fetched successfully.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    required: false,
    description: 'Agent Id',
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
  @Get('/{:agentId}')
  public viewAgents(
    @Param('agentId') agentId: number,
    @Query() agentQuery: GetAgentsDto,
  ) {
    return this.agentService.getAllAgents(agentId, agentQuery);
  }
}

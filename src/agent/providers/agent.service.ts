import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/users/user.entity';
import { CreateAgentDto } from '../dtos/create-agent.dto';
import { GetAgentsDto } from '../dtos/get-agents.dto';
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface';
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider';
import { Agent } from '../agent.entity';

@Injectable()
export class AgentService {
  constructor(
    /**
     * Inject Agent Repository
     */
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,

    /**
     * Inject User Repository
     */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    /**
     * Inject Pagination Provider
     */
    private readonly paginationProvider: PaginationProvider,
  ) { }


  /**
   * Method to get agent profile by user ID
   */
  async getAgentProfile(userId: number): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: { user: { id: userId } },
      relations: ['kyc', 'bank_account'],
    });
    if (!agent) throw new NotFoundException('Agent profile not found');
    return agent;
  }

  /**
   * Method to get all agents or a specific agent by ID
   */
  async getAllAgents(
    agentId: number,
    agentQuery: GetAgentsDto,
  ): Promise<Paginated<Agent> | Agent[]> {
    if (agentId) {
      let agent: Agent | null;
      try {
        agent = await this.agentRepository.findOne({
          where: { id: agentId },
          relations: ['kyc', 'bank_account'],
        });
      } catch (error) {
        console.error('Error fetching users:', error);
        throw new InternalServerErrorException('Failed to find agent');
      }

      if (!agent) {
        throw new NotFoundException('Agent not found');
      }

      // If a specific user ID is provided, return that user
      return [agent];
    }

    let agents = await this.paginationProvider.paginateQuery(
      {
        page: agentQuery.page || 1,
        limit: agentQuery.limit || 10,
      },
      this.agentRepository,
      {
        order: { createdAt: 'ASC' },
      },
    );

    // If no user ID is provided, return all agents
    return agents;
  }

  /**
   * Method to update a profile
   */
  async updateAgentProfile(
    userId: number,
    dto: CreateAgentDto,
  ): Promise<Agent> {
    const {
      businessName,
      address,
      bio,
      statesCovered,
    } = dto;

    // Ensure user exists & is an agent
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isAgent) {
      throw new BadRequestException('User is not registered as an agent');
    }

    // Fetch existing agent profile
    const agent = await this.agentRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!agent) {
      throw new NotFoundException('Agent profile not found');
    }

    // Update only provided fields
    Object.assign(agent, {
      ...(businessName && { businessName }),
      ...(address && { address }),
      ...(bio && { bio }),
      ...(statesCovered && { statesCovered }),
    });

    return await this.agentRepository.save(agent);
  }

}

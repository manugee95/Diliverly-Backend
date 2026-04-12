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
  ) {}

  /**
   * Method to create or update an agent profile
   */
  async createOrUpdateAgentProfile(
    userId: number,
    dto: CreateAgentDto,
  ): Promise<Agent> {
    const { businessName, address, bio, statesCovered } = dto;
    // Ensure user exists & is an agent
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if agent profile already exists
    let agent = await this.agentRepository.findOne({
      where: { user: { id: userId } },
    });

    if (agent) {
      // Update existing profile
      Object.assign(agent, {
        businessName: businessName || agent.businessName,
        address: address || agent.address,
        bio: bio || agent.bio,
        statesCovered: statesCovered || agent.statesCovered,
      });
    } else {
      // Create new profile
      agent = this.agentRepository.create({
        user: { id: userId },
        businessName,
        address,
        bio,
        statesCovered,
      });
    }

    //Update user's isAgent if creating a new agent profile
    if (!agent.id) {
      user.isAgent = true;
      await this.userRepository.save(user);
    }

    return await this.agentRepository.save(agent);
  }

  /**
   * Method to get agent profile by user ID
   */
  async getAgentProfile(userId: number): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: { user: { id: userId } },
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
          relations: ['reviews'],
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

}

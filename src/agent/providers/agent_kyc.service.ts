import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../entities/agent.entity';
import { Agent_KYC } from '../entities/agent_kyc.entity';
import { YouverifyProvider } from './youverify.provider';
import { CreateAgentKycDto } from '../dtos/create-agent-kyc.dto';
import * as bcrypt from 'bcrypt';
import { KYCStatus } from '../enums/kycStatus.enum';

@Injectable()
export class AgentKycService {
  constructor(
    /**
     * Inject Agent Repository
     */
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,

    /**
     * Inject Agent_KYC Repository
     */
    @InjectRepository(Agent_KYC)
    private readonly kycRepository: Repository<Agent_KYC>,

    /**
     * Inject Youverify Provider
     */
    private readonly youverifyProvider: YouverifyProvider,
  ) {}

  async addAgentKyc(
    agentId: number,
    dto: CreateAgentKycDto,
  ): Promise<Agent_KYC> {
    const { nin, bvn, selfieImageUrl } = dto;

    // Check if agent exists (with bank account relation)
    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
      relations: ['bank_account'],
    });
    if (!agent) throw new NotFoundException('Agent not found');

    // Ensure no existing KYC
    const existingKyc = await this.kycRepository.findOne({
      where: { agent: { id: agentId } },
    });
    if (existingKyc)
      throw new BadRequestException('KYC already submitted for this agent');

    // Ensure agent has a valid bank account
    if (!agent.bank_account || !agent.bank_account.accountName) {
      throw new BadRequestException('Agent has no valid bank account details');
    }

    // 4Verify BVN / NIN via Youverify
    const verifyResponses: Record<string, any> = {};
    let verifiedFullName = '';

    if (bvn) {
      const bvnResult = await this.youverifyProvider.verifyIdentity(
        'ibvn',
        bvn,
      );
      if (!bvnResult || bvnResult.status !== 'success') {
        throw new BadRequestException('BVN verification failed');
      }
      verifiedFullName =
        `${bvnResult.data.firstName} ${bvnResult.data.lastName}`.trim();
      verifyResponses.bvn = bvnResult;
    }

    if (nin) {
      const ninResult = await this.youverifyProvider.verifyIdentity('nin', nin);
      if (!ninResult || ninResult.status !== 'success') {
        throw new BadRequestException('NIN verification failed');
      }
      if (!verifiedFullName) {
        verifiedFullName =
          `${ninResult.data.firstName} ${ninResult.data.lastName}`.trim();
      }
      verifyResponses.nin = ninResult;
    }

    // 5️⃣ Compare verified identity name with bank account name
    const normalizedBankName = agent.bank_account.accountName
      .toLowerCase()
      .trim();
    const normalizedVerifiedName = verifiedFullName.toLowerCase().trim();

    // Split verified name into parts (e.g. "John Michael Doe" → ["John", "Michael", "Doe"])
    const nameParts = normalizedVerifiedName.split(/\s+/);

    // Ensure at least first and last name exist
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];

    // Check if both first and last names appear in the bank account name
    const firstNameMatch = normalizedBankName.includes(firstName);
    const lastNameMatch = normalizedBankName.includes(lastName);

    if (!firstNameMatch || !lastNameMatch) {
      throw new BadRequestException(
        `Bank account name "${agent.bank_account.accountName}" does not match verified identity name "${verifiedFullName}"`,
      );
    }

    // 6️⃣ Facial Recognition Verification
    const referenceImageUrl =
      verifyResponses.nin?.data?.image ||
      verifyResponses.bvn?.data?.image ||
      null;

    if (!referenceImageUrl) {
      throw new BadRequestException(
        'No reference image found for facial comparison',
      );
    }

    // const faceMatchResult = await this.youverifyProvider.verifyFaceMatch({
    //   selfieUrl: selfieImageUrl,
    //   referenceImageUrl,
    // });

    // if (!faceMatchResult || faceMatchResult.similarity < 0.85) {
    //   throw new BadRequestException('Facial recognition verification failed');
    // }

    // verifyResponses.faceMatch = faceMatchResult;

    // 7️⃣ Hash identifiers
    const ninHash = nin ? await bcrypt.hash(nin, 10) : null;
    const bvnHash = bvn ? await bcrypt.hash(bvn, 10) : null;

    // 8️⃣ Save KYC record
    const kycRecord = this.kycRepository.create({
      agent,
      ninHash,
      bvnHash,
      kyc_provider_response: JSON.stringify(verifyResponses),
    });

    const saved = await this.kycRepository.save(kycRecord);

    // 9️⃣ Update Agent verification status
    agent.kycStatus = KYCStatus.VERIFIED;
    await this.agentRepository.save(agent);

    return saved;
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Agent } from '../entities/agent.entity';
import { Repository } from 'typeorm';
import { Agent_Bank_Account } from '../entities/agent_bank_account.entity';
import { CreateAgentBankAccountDto } from '../dtos/create-agent-bank-account.dto';
import axios from 'axios';
import { log } from 'console';
import { PatchAgentBankAccountDto } from '../dtos/patch-agent-bank-account.dto';

@Injectable()
export class AgentBankAccountService {
  constructor(
    /**
     * Inject Agent Repository
     */
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,

    /**
     * Inject Agent_Bank_Account Repository
     */
    @InjectRepository(Agent_Bank_Account)
    private readonly bankRepository: Repository<Agent_Bank_Account>,
  ) {}

  /**
   * Method to add a bank account for an agent
   */
  async addBankAccount(
    agentId: number,
    dto: CreateAgentBankAccountDto,
  ): Promise<Agent_Bank_Account> {
    const { bankCode, accountNumber } = dto;

    // 1. Verify agent exists
    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    // 2. Check if already has a bank account
    const existing = await this.bankRepository.findOne({
      where: { agent: { id: agentId } },
    });
    if (existing)
      throw new BadRequestException('Agent bank account already added');

    // 3. Verify with Paystack
    let verifiedData: any;
    try {
      const res = await axios.get(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        },
      );
      if (!res.data.status) {
        throw new BadRequestException('Invalid bank details');
      }
      verifiedData = res.data.data;
    } catch (error) {
      console.error('Bank verification failed:', error.message);
      throw new BadRequestException('Bank verification failed');
    }

    const { account_name, account_number, bank_id } = verifiedData;

    // 4. Fetch bank name using bank_id
    let bankName: string;
    try {
      const bankListRes = await axios.get('https://api.paystack.co/bank', {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      });

      const bankList = bankListRes.data?.data || [];
      const matchedBank = bankList.find((b) => b.id === bank_id);

      if (!matchedBank)
        throw new BadRequestException('Bank name could not be identified');

      bankName = matchedBank.name;
    } catch (error) {
      console.error('Failed to fetch bank name:', error.message);
      throw new BadRequestException('Could not fetch bank name');
    }

    // 5. Verify account name matches user profile name
    const normalizedAccountName = account_name.toLowerCase().trim();

    const firstNameMatch = normalizedAccountName.includes(
      agent.user.firstName.toLowerCase(),
    );
    const lastNameMatch = normalizedAccountName.includes(
      agent.user.lastName.toLowerCase(),
    );

    if (!firstNameMatch || !lastNameMatch) {
      throw new BadRequestException(
        `Account name "${account_name}" does not match user name "${agent.user.firstName} ${agent.user.lastName}"`,
      );
    }

    // 6. Save bank info
    const bank = this.bankRepository.create({
      agent,
      bankName,
      bankCode,
      accountName: account_name,
      accountNumber: account_number,
    });

    return await this.bankRepository.save(bank);
  }

  /**
   * Method to get an agent's bank account details
   */
  async getBankAccount(agentId: number): Promise<Agent_Bank_Account> {
    const bank = await this.bankRepository.findOne({
      where: { agent: { id: agentId } },
    });
    if (!bank) throw new NotFoundException('Bank account not found');
    return bank;
  }

  /**
   * Method to update an agent's bank account details
   */
  async updateBankAccount(
    agentId: number,
    dto: PatchAgentBankAccountDto,
  ): Promise<Agent_Bank_Account> {
    const { bankCode, accountNumber } = dto;

    // 1. Verify agent exists
    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
      relations: ['user', 'bank_account'],
    });
    if (!agent) throw new NotFoundException('Agent not found');

    // 2. Ensure agent already has a bank account
    const existingBankAccount = agent.bank_account;
    if (!existingBankAccount) {
      throw new BadRequestException('No bank account found for this agent');
    }

    // 3. Verify account details with Paystack
    let verifiedData: any;
    try {
      const res = await axios.get(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        },
      );
      if (!res.data.status) {
        throw new BadRequestException('Invalid bank details');
      }
      verifiedData = res.data.data;
    } catch (error) {
      console.error(
        'Bank verification failed:',
        error.response?.data || error.message,
      );
      throw new BadRequestException('Bank verification failed');
    }

    const { account_name, account_number, bank_id } = verifiedData;

    // 4. Ensure account name matches user's full name
    const normalizedAccountName = account_name.toLowerCase().trim();

    const firstNameMatch = normalizedAccountName.includes(
      agent.user.firstName.toLowerCase(),
    );
    const lastNameMatch = normalizedAccountName.includes(
      agent.user.lastName.toLowerCase(),
    );

    if (!firstNameMatch || !lastNameMatch) {
      throw new BadRequestException(
        `Account name "${account_name}" does not match user name "${agent.user.firstName} ${agent.user.lastName}"`,
      );
    }

    // 5. Fetch bank name by bank code (from Paystack's bank list)
    let bankName: string;
    try {
      const bankListRes = await axios.get('https://api.paystack.co/bank', {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      });

      const bankList = bankListRes.data?.data || [];
      const matchedBank = bankList.find((b) => b.id === bank_id);

      if (!matchedBank)
        throw new BadRequestException('Bank name could not be identified');

      bankName = matchedBank.name;
    } catch (error) {
      console.error('Failed to fetch bank name:', error.message);
      throw new BadRequestException('Could not fetch bank name');
    }

    // 6. Update and save the bank account
    existingBankAccount.bankName = bankName;
    existingBankAccount.bankCode = bankCode;
    existingBankAccount.accountName = account_name;
    existingBankAccount.accountNumber = account_number;

    return await this.bankRepository.save(existingBankAccount);
  }
}

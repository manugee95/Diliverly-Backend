import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBankAccountDto } from '../dtos/create-bank-account.dto';
import { Bank_Account } from '../bank-account.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';
import { Repository } from 'typeorm';
import axios from 'axios';
import { PatchBankAccountDto } from '../dtos/patch-bank-account.dto';

@Injectable()
export class BankAccountService {
  constructor(
    /**
     * Inject User Repository
     */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    /**
     * Inject Bank_Account Repository
     */
    @InjectRepository(Bank_Account)
    private readonly bankRepository: Repository<Bank_Account>,
  ) {}

  /**
   * Method to add a bank account for a user
   */
  async addBankAccount(
    userId: number,
    dto: CreateBankAccountDto,
  ): Promise<Bank_Account> {
    const { bankCode, accountNumber } = dto;

    // 1. Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    // 2. Ensure user has not added bank already
    const existing = await this.bankRepository.findOne({
      where: { user: { id: userId } },
    });
    if (existing) throw new BadRequestException('Bank account already added');

    // 3. Verify bank account via Paystack
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

      if (!res.data.status)
        throw new BadRequestException('Invalid bank details');

      verifiedData = res.data.data;
    } catch (error) {
      throw new BadRequestException('Bank verification failed');
    }

    const { account_name, account_number, bank_id } = verifiedData;

    // 4. Fetch bank name
    const bankListRes = await axios.get('https://api.paystack.co/bank', {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const matchedBank = bankListRes.data.data.find((b) => b.id === bank_id);
    if (!matchedBank) throw new BadRequestException('Bank not recognized');

    // 5. Validate account name matches user
    const normalized = account_name.toLowerCase();
    if (
      !normalized.includes(user.firstName.toLowerCase()) ||
      !normalized.includes(user.lastName.toLowerCase())
    ) {
      throw new BadRequestException(
        `Account name "${account_name}" does not match user full name`,
      );
    }

    // 6. Save bank account
    const bank = this.bankRepository.create({
      user,
      bankName: matchedBank.name,
      bankCode,
      accountName: account_name,
      accountNumber: account_number,
    });

    return this.bankRepository.save(bank);
  }

  /**
   * Method to get a user's bank account details
   */
  async getBankAccount(userId: number): Promise<Bank_Account> {
    const bank = await this.bankRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!bank) {
      throw new NotFoundException('Bank account not found');
    }

    return bank;
  }

  /**
   * Method to update a user's bank account details
   */
  async updateBankAccount(
    userId: number,
    dto: PatchBankAccountDto,
  ): Promise<Bank_Account> {
    const { bankCode, accountNumber } = dto;

    // 1. Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    // 2. Ensure user has a bank account
    const existingBankAccount = await this.bankRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!existingBankAccount) {
      throw new BadRequestException('No bank account found for this user');
    }

    // 3. Verify bank details with Paystack
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
      throw new BadRequestException('Bank verification failed');
    }

    const { account_name, account_number, bank_id } = verifiedData;

    // 4. Validate account name matches user profile
    const normalizedAccountName = account_name.toLowerCase();

    if (
      !normalizedAccountName.includes(user.firstName.toLowerCase()) ||
      !normalizedAccountName.includes(user.lastName.toLowerCase())
    ) {
      throw new BadRequestException(
        `Account name "${account_name}" does not match user's name`,
      );
    }

    // 5. Fetch bank name from Paystack
    let bankName: string;
    try {
      const bankListRes = await axios.get('https://api.paystack.co/bank', {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      });

      const matchedBank = bankListRes.data.data.find((b) => b.id === bank_id);

      if (!matchedBank) {
        throw new BadRequestException('Bank name could not be identified');
      }

      bankName = matchedBank.name;
    } catch (error) {
      throw new BadRequestException('Could not fetch bank name');
    }

    // 6. Update and save
    existingBankAccount.bankName = bankName;
    existingBankAccount.bankCode = bankCode;
    existingBankAccount.accountName = account_name;
    existingBankAccount.accountNumber = account_number;

    return this.bankRepository.save(existingBankAccount);
  }
}

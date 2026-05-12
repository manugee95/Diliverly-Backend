import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { User } from '../../users/user.entity';
import { Verification } from '../verification.entity';
import { SmileIdService } from './smile-id.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationType } from '../enums/verificationType.enum';
import { VerificationStatus } from '../enums/verificationStatus.enum';
import { KycDto } from '../dtos/kyc.dto';
import { KybDto } from '../dtos/kyb.dto';
import { Agent } from '../../agent/agent.entity';
import { S3Service } from '../../s3/providers/s3.service';
import { first } from 'rxjs';
import { PoaDto } from '../dtos/poa.dto';

@Injectable()
export class VerificationsService {
  constructor(
    private readonly smileService: SmileIdService,
    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly s3Service: S3Service,
  ) {}

  async verifyKyc(userId: number, dto: KycDto, file: Express.Multer.File) {
    // -----------------------------------
    // 1. FIND USER
    // -----------------------------------

    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // -----------------------------------
    // 2. UPLOAD DOCUMENT
    // -----------------------------------

    const documentUrl = await this.s3Service.uploadFile(file);

    // -----------------------------------
    // 3. GENERATE JOB ID
    // -----------------------------------

    const jobId = `KYC_${user.id}_${Date.now()}`;

    // -----------------------------------
    // 4. CREATE VERIFICATION RECORD
    // -----------------------------------

    const verification = this.verificationRepo.create({
      user,
      type:
        dto.idType === 'VOTER_ID'
          ? VerificationType.VOTER_ID
          : VerificationType.NIN,
      idNumber: dto.idNumber,
      documentUrl,
      status: VerificationStatus.PENDING,
      smileJobId: jobId,
      smileJobComplete: false,
    });

    await this.verificationRepo.save(verification);

    try {
      // -----------------------------------
      // 5. PREPARE SMILE PAYLOAD
      // -----------------------------------

      const payload = {
        country: 'NG',
        first_name: user.firstName,
        last_name: user.lastName,
        id_type: dto.idType,
        id_number: dto.idNumber,
        callback_url: process.env.SMILE_CALLBACK_URL!,
        partner_params: {
          job_id: jobId,
          user_id: String(user.id),
          sandbox_result: 0, // Force success in sandbox
        },
      };

      // -----------------------------------
      // 6. SEND TO SMILE
      // -----------------------------------

      const result = await this.smileService.verifyKyc(payload);

      // -----------------------------------
      // 7. SAVE REQUEST/RESPONSE
      // -----------------------------------

      verification.smileRequest = payload;

      verification.smileResponse = result;

      /**
       * Verification still pending
       * until callback confirms success
       */

      await this.verificationRepo.save(verification);

      return {
        message: 'Verification submitted successfully',

        verificationId: verification.id,

        status: verification.status,
      };
    } catch (error: any) {
      console.log(
        'SMILE VERIFICATION ERROR:',
        error?.response?.data || error.message,
      );

      // -----------------------------------
      // 8. UPDATE STATUS TO FAILED
      // -----------------------------------

      verification.status = VerificationStatus.FAILED;

      verification.smileResponse = error?.response?.data || {
        message: error.message,
      };

      verification.smileJobComplete = true;

      await this.verificationRepo.save(verification);

      // -----------------------------------
      // 9. THROW CLEAN ERROR
      // -----------------------------------

      if (error?.response?.data) {
        throw new BadRequestException({
          message: 'Smile verification failed',

          error: error.response.data,
        });
      }

      throw new InternalServerErrorException(
        'Unable to process KYC verification',
      );
    }
  }

  async verifyKyb(userId: number, dto: KybDto, file: Express.Multer.File) {
    // -----------------------------------
    // 1. FIND USER
    // -----------------------------------

    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // -----------------------------------
    // 2. UPLOAD DOCUMENT
    // -----------------------------------

    const documentUrl = await this.s3Service.uploadFile(file);

    // -----------------------------------
    // 3. GENERATE JOB ID
    // -----------------------------------

    const jobId = `KYC_${user.id}_${Date.now()}`;

    // -----------------------------------
    // 4. CREATE VERIFICATION RECORD
    // -----------------------------------

    const verification = this.verificationRepo.create({
      user,
      type:
        dto.idType === 'BUSINESS_REGISTRATION'
          ? VerificationType.CAC
          : VerificationType.CAC,
      idNumber: dto.idNumber,
      documentUrl,
      status: VerificationStatus.PENDING,
      smileJobId: jobId,
      smileJobComplete: false,
    });

    await this.verificationRepo.save(verification);

    try {
      // -----------------------------------
      // 5. PREPARE SMILE PAYLOAD
      // -----------------------------------

      const payload = {
        country: 'NG',
        id_type: dto.idType,
        business_type: dto.businessType,
        id_number: dto.idNumber,
        callback_url: process.env.SMILE_CALLBACK_URL!,
        partner_params: {
          job_id: jobId,
          user_id: String(user.id),
        },
      };

      // -----------------------------------
      // 6. SEND TO SMILE
      // -----------------------------------

      const result = await this.smileService.verifyKyb(payload);

      // -----------------------------------
      // 7. SAVE REQUEST/RESPONSE
      // -----------------------------------

      verification.smileRequest = payload;

      verification.smileResponse = result;

      /**
       * Verification still pending
       * until callback confirms success
       */

      await this.verificationRepo.save(verification);

      return {
        message: 'Verification submitted successfully',

        verificationId: verification.id,

        status: verification.status,
      };
    } catch (error: any) {
      console.log(
        'SMILE VERIFICATION ERROR:',
        error?.response?.data || error.message,
      );

      // -----------------------------------
      // 8. UPDATE STATUS TO FAILED
      // -----------------------------------

      verification.status = VerificationStatus.FAILED;

      verification.smileResponse = error?.response?.data || {
        message: error.message,
      };

      verification.smileJobComplete = true;

      await this.verificationRepo.save(verification);

      // -----------------------------------
      // 9. THROW CLEAN ERROR
      // -----------------------------------

      if (error?.response?.data) {
        throw new BadRequestException({
          message: 'Smile verification failed',

          error: error.response.data,
        });
      }

      throw new InternalServerErrorException(
        'Unable to process KYB verification',
      );
    }
  }

  async verifyPoa(userId: number, dto: PoaDto, file: Express.Multer.File) {
    // -----------------------------------
    // 1. FIND USER
    // -----------------------------------

    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // -----------------------------------
    // 2. UPLOAD DOCUMENT
    // -----------------------------------

    const documentUrl = await this.s3Service.uploadFile(file);

    // -----------------------------------
    // 3. GENERATE JOB ID
    // -----------------------------------

    const jobId = `KYC_${user.id}_${Date.now()}`;

    // -----------------------------------
    // 4. CREATE VERIFICATION RECORD
    // -----------------------------------

    const verification = this.verificationRepo.create({
      user,
      type:
        dto.idType === 'Proof of Address'
          ? VerificationType.PROOF_OF_ADDRESS
          : VerificationType.PROOF_OF_ADDRESS,
      idNumber: dto.utility_number,
      documentUrl,
      status: VerificationStatus.PENDING,
      smileJobId: jobId,
      smileJobComplete: false,
    });

    await this.verificationRepo.save(verification);

    try {
      // -----------------------------------
      // 5. PREPARE SMILE PAYLOAD
      // -----------------------------------

      const payload = {
        country: 'NG',
        address: dto.address,
        utility_number: dto.utility_number,
        utility_provider: dto.utility_provider,
        utility_type: dto.utility_type,
        callback_url: process.env.SMILE_CALLBACK_URL!,
        partner_params: { 
          job_id: jobId,
          user_id: String(user.id),
        },
      };

      // -----------------------------------
      // 6. SEND TO SMILE
      // -----------------------------------

      const result = await this.smileService.verifyPoa(payload);

      // -----------------------------------
      // 7. SAVE REQUEST/RESPONSE
      // -----------------------------------

      verification.smileRequest = payload;

      verification.smileResponse = result;

      /**
       * Verification still pending
       * until callback confirms success
       */

      await this.verificationRepo.save(verification);

      return {
        message: 'Verification submitted successfully',

        verificationId: verification.id,

        status: verification.status,
      };
    } catch (error: any) {
      console.log(
        'SMILE VERIFICATION ERROR:',
        error?.response?.data || error.message,
      );

      // -----------------------------------
      // 8. UPDATE STATUS TO FAILED
      // -----------------------------------

      verification.status = VerificationStatus.FAILED;

      verification.smileResponse = error?.response?.data || {
        message: error.message,
      };

      verification.smileJobComplete = true;

      await this.verificationRepo.save(verification);

      // -----------------------------------
      // 9. THROW CLEAN ERROR
      // -----------------------------------

      if (error?.response?.data) {
        throw new BadRequestException({
          message: 'Smile verification failed',

          error: error.response.data,
        });
      }

      throw new InternalServerErrorException(
        'Unable to process KYB verification',
      );
    }
  }
}

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
import { PoaDto } from '../dtos/poa.dto';
import {
  AdminVerificationAction,
  AdminVerificationDecisionDto,
} from '../dtos/av.dto';
import { GetVerificationsDto } from '../dtos/getVerifications.dto';
import { PaginationProvider } from '../../common/pagination/providers/pagination.provider';

@Injectable()
export class VerificationsService {
  constructor(
    private readonly smileService: SmileIdService,
    private readonly s3Service: S3Service,
    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    /**
     * Injecting Pagination Provider
     */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  // ======================================================
  // KYC VERIFICATION LOGIC
  // ======================================================
  async verifyKyc(userId: number, dto: KycDto) {
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

    // const documentUrl = await this.s3Service.uploadFile(file);

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

  // ======================================================
  // KYB VERIFICATION LOGIC
  // ======================================================
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
      type: VerificationType.BUSINESS_REGISTRATION,
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
        id_type: VerificationType.BUSINESS_REGISTRATION,
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

  // ======================================================
  // POA VERIFICATION LOGIC
  // ======================================================
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
      type: VerificationType.PROOF_OF_ADDRESS,
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

  // ======================================================
  // Get user verification status
  // ======================================================
  async getUserVerificationStatus(userId: number) {
    const user = await this.userRepo.findOne({
      where: {
        id: userId,
      },
      relations: ['agent'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const verifications = await this.verificationRepo.find({
      where: {
        user: {
          id: userId,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });

    const kyc = verifications.find((v) => v.type === VerificationType.NIN);

    const kyb = verifications.find(
      (v) => v.type === VerificationType.BUSINESS_REGISTRATION,
    );

    const poa = verifications.find(
      (v) => v.type === VerificationType.PROOF_OF_ADDRESS,
    );

    return {
      userId: user.id,

      isKycVerified: user.isKycVerified,

      isAgent: user.isAgent,

      kyc,

      kyb,

      poa,

      isKybVerified: user.agent?.isKybVerified ?? false,

      isProofOfAddressVerified: user.agent?.isProofOfAddressVerified ?? false,
    };
  }

  // ======================================================
  // ADMIN REVIEW FOR KYB + POA
  // ======================================================
  async adminReviewVerification(
    verificationId: number,
    dto: AdminVerificationDecisionDto,
    adminUserId: number,
  ) {
    // --------------------------------------------------
    // 1. FIND VERIFICATION
    // --------------------------------------------------

    const verification = await this.verificationRepo.findOne({
      where: {
        id: verificationId,
      },
      relations: ['user'],
    });

    if (!verification) {
      throw new NotFoundException('Verification record not found');
    }

    // --------------------------------------------------
    // 2. ONLY KYB + POA REQUIRE ADMIN REVIEW
    // --------------------------------------------------

    const allowedTypes = [
      VerificationType.BUSINESS_REGISTRATION,
      VerificationType.PROOF_OF_ADDRESS,
    ];

    if (!allowedTypes.includes(verification.type)) {
      throw new BadRequestException(
        'This verification does not require admin approval',
      );
    }

    // --------------------------------------------------
    // 3. FIND AGENT
    // --------------------------------------------------

    const agent = await this.agentRepo.findOne({
      where: {
        user: {
          id: verification.user.id,
        },
      },
      relations: ['user'],
    });

    if (!agent) {
      throw new NotFoundException('Agent profile not found');
    }

    // --------------------------------------------------
    // 4. HANDLE REJECTION
    // --------------------------------------------------

    if (dto.action === AdminVerificationAction.REJECT) {
      verification.status = VerificationStatus.REJECTED;

      verification.rejectionReason =
        dto.rejectionReason || 'Verification rejected by admin';

      await this.verificationRepo.save(verification);

      return {
        success: true,
        message: 'Verification rejected successfully',
      };
    }

    // --------------------------------------------------
    // 5. HANDLE APPROVAL
    // --------------------------------------------------

    verification.status = VerificationStatus.VERIFIED;

    verification.rejectionReason = undefined;

    verification.reviewedByAdminId = adminUserId;

    verification.reviewedAt = new Date();

    await this.verificationRepo.save(verification);

    // --------------------------------------------------
    // 6. UPDATE AGENT FLAGS
    // --------------------------------------------------

    if (verification.type === VerificationType.BUSINESS_REGISTRATION) {
      agent.isKybVerified = true;
    }

    if (verification.type === VerificationType.PROOF_OF_ADDRESS) {
      agent.isProofOfAddressVerified = true;
    }

    // --------------------------------------------------
    // 7. FINAL AGENT APPROVAL CHECK
    // --------------------------------------------------

    /**
     * Agent becomes fully verified ONLY IF:
     *
     * - User KYC completed
     * - KYB approved
     * - POA approved
     */

    const userKycVerified = verification.user.isKycVerified;

    const kybVerified = agent.isKybVerified;

    const poaVerified = agent.isProofOfAddressVerified;

    if (userKycVerified && kybVerified && poaVerified) {
      agent.isVerified = true;
    }

    await this.agentRepo.save(agent);

    return {
      success: true,
      message: 'Verification approved successfully',

      data: {
        agentId: agent.id,
        isKybVerified: agent.isKybVerified,

        isProofOfAddressVerified: agent.isProofOfAddressVerified,

        isVerified: agent.isVerified,
      },
    };
  }

  // ======================================================
  // Admin get all verifications with filters
  // ======================================================
  async getAllVerifications(
    userId: number,
    verificationsQuery: GetVerificationsDto,
  ) {
    const admin = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!admin) throw new BadRequestException('admin access only');

    const page = verificationsQuery.page || 1;
    const limit = verificationsQuery.limit || 10;

    const where: any = {
      user: { id: userId },
    };

    if (verificationsQuery.status) {
      where.status = verificationsQuery.status;
    }

    const verifications = await this.paginationProvider.paginateQuery(
      { page, limit },
      this.verificationRepo,
      {
        where,
        order: { createdAt: 'DESC' },
      },
    );

    return verifications;
  }
}

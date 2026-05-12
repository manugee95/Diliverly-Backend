import {
  Body,
  Controller,
  Headers,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Verification } from './verification.entity';
import { User } from '../users/user.entity';
import { VerificationStatus } from './enums/verificationStatus.enum';
import { KycDto } from './dtos/kyc.dto';
import { VerificationsService } from './providers/verifications.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { KybDto } from './dtos/kyb.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { AuthType } from '../auth/enums/auth-type.enum';
import { VerificationType } from './enums/verificationType.enum';
import { PoaDto } from './dtos/poa.dto';

@Controller('verifications')
export class VerificationsController {
  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly verificationsService: VerificationsService,
  ) {}

  /**
   * Endpoint to verify KYC
   */
  @ApiOperation({
    summary: 'Verify KYC',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC verification initiated.',
  })
  @UseInterceptors(
    FileInterceptor('document', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @Post('/kyc')
  async verifyKyc(
    @Body() dto: KycDto,
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user.id;
    return this.verificationsService.verifyKyc(userId, dto, file);
  }

  /**
   * Endpoint to verify KYB
   */
  @ApiOperation({
    summary: 'Verify KYB',
  })
  @ApiResponse({
    status: 200,
    description: 'KYB verification initiated.',
  })
  @UseInterceptors(
    FileInterceptor('document', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @Post('/kyb')
  async verifyKyb(
    @Body() dto: KybDto,
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user.id;
    return this.verificationsService.verifyKyb(userId, dto, file);
  }

  /**
   * Endpoint to verify POA
   */
  @ApiOperation({
    summary: 'Verify POA',
  })
  @ApiResponse({
    status: 200,
    description: 'POA verification initiated.',
  })
  @UseInterceptors(
    FileInterceptor('document', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @Post('/poa')
  async verifyPoa(
    @Body() dto: PoaDto,
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user.id;
    return this.verificationsService.verifyPoa(userId, dto, file);
  }

  /**
   * Smile ID Callback Endpoint
   */
  @Auth(AuthType.None)
  @Post('/smile-callback')
  async handleSmileCallback(@Req() req: any, @Body() body: any) {
    console.log('--- SMILE CALLBACK RECEIVED ---');

    // -----------------------------------
    // Find User
    // -----------------------------------
    // const userId = req.user?.id;

    // -----------------------------------
    // 1. VERIFY SIGNATURE
    // -----------------------------------

    const signature = body?.signature;

    const timestamp = body?.timestamp;

    if (!this.verifySmileSignature(timestamp, signature)) {
      throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
    }

    // -----------------------------------
    // 2. EXTRACT JOB ID
    // -----------------------------------

    const jobId = body?.PartnerParams?.job_id || body?.partner_params?.job_id;

    if (!jobId) {
      throw new HttpException('No job id found', HttpStatus.BAD_REQUEST);
    }

    // -----------------------------------
    // 3. FIND VERIFICATION
    // -----------------------------------

    const verification = await this.verificationRepo.findOne({
      where: {
        smileJobId: jobId,
      },
      relations: ['user'],
    });

    if (!verification) {
      throw new HttpException('Verification not found', HttpStatus.NOT_FOUND);
    }

    // -----------------------------------
    // 4. SAVE RAW RESPONSE
    // -----------------------------------

    verification.smileResponse = body;

    verification.smileJobComplete = true;

    console.log(verification.type);
    console.log(signature);

    // -----------------------------------
    // 5. CHECK SMILE RESULT
    // -----------------------------------

    const resultCode = body?.ResultCode || body?.result_code;

    const isApproved = ['0810', '1012'].includes(resultCode?.toString());

    // -----------------------------------
    // 6. HANDLE FAILURE
    // -----------------------------------

    if (!isApproved) {
      verification.status = VerificationStatus.FAILED;

      verification.rejectionReason = body?.ResultText || 'Verification failed';

      await this.verificationRepo.save(verification);

      return { success: true };
    }

    // -----------------------------------
    // 7. PRODUCT-SPECIFIC VALIDATION
    // -----------------------------------

    let passed = false;

    switch (verification.type) {
      // ===================================
      // KYC
      // ===================================

      case VerificationType.NIN:

      case VerificationType.VOTER_ID: {
        passed = this.validateKycNames(verification, body);

        if (passed) {
          verification.status = VerificationStatus.VERIFIED;

          verification.user.isKycVerified = true;

          await this.userRepo.save(verification.user);
        } else {
          verification.status = VerificationStatus.FAILED;

          verification.rejectionReason = 'Name mismatch';
        }

        break;
      }

      // ===================================
      // KYB
      // ===================================

      case VerificationType.CAC: {
        passed = this.validateBusinessRegistration(verification, body);

        if (passed) {
          verification.status = VerificationStatus.VERIFIED;
        } else {
          verification.status = VerificationStatus.FAILED;

          verification.rejectionReason = 'Business registration mismatch';
        }

        break;
      }

      // ===================================
      // PROOF OF ADDRESS
      // ===================================

      case VerificationType.PROOF_OF_ADDRESS: {
        if (isApproved) {
          verification.status = VerificationStatus.VERIFIED;
        } else {
          verification.status = VerificationStatus.FAILED;

          verification.rejectionReason = 'Address mismatch';
        }

        break;
      }

      default:
        verification.status = VerificationStatus.FAILED;

        verification.rejectionReason = 'Unsupported verification type';
    }

    // -----------------------------------
    // 8. SAVE FINAL RESULT
    // -----------------------------------

    await this.verificationRepo.save(verification);

    return { success: true };
  }

  private verifySmileSignature(
    timestamp: string,
    receivedSignature: string,
  ): boolean {
    try {
      // 1. Replay Attack Prevention (Optional but recommended)
      const now = Date.now();
      const requestTime = new Date(timestamp).getTime();
      const fiveMinutes = 5 * 60 * 1000;
      if (Math.abs(now - requestTime) > fiveMinutes) return false;

      // 2. Generate Local Signature
      // Smile ID signatures are: HMAC_SHA256(apiKey, timestamp + partnerId + "sid_request")
      const hmac = crypto.createHmac('sha256', process.env.SMILE_API_KEY!);
      hmac.update(timestamp, 'utf8');
      hmac.update(process.env.SMILE_PARTNER_ID!, 'utf8');
      hmac.update('sid_request', 'utf8');

      const generatedSignature = hmac.digest('base64');

      // 3. Timing-safe comparison
      const receivedBuffer = Buffer.from(receivedSignature, 'base64');
      const generatedBuffer = Buffer.from(generatedSignature, 'base64');

      if (receivedBuffer.length !== generatedBuffer.length) return false;
      return crypto.timingSafeEqual(generatedBuffer, receivedBuffer);
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  private validateKycNames(verification: Verification, body: any): boolean {
    const smileFirstName = body?.FirstName || body?.first_name || '';

    const smileLastName = body?.LastName || body?.last_name || '';

    const requestFirstName = verification.smileRequest.first_name || '';

    const requestLastName = verification.smileRequest.last_name || '';

    return (
      this.normalize(smileFirstName) === this.normalize(requestFirstName) &&
      this.normalize(smileLastName) === this.normalize(requestLastName)
    );
  }

  private validateBusinessRegistration(
    verification: Verification,
    body: any,
  ): boolean {
    const smileRcNumber = body?.company_information?.registration_number || '';

    const submittedRcNumber = verification.smileRequest.id_number || '';

    return this.normalize(smileRcNumber) === this.normalize(submittedRcNumber);
  }

  //   private validateProofOfAddress(
  //     verification: Verification,
  //     body: any,
  //   ): boolean {
  //     const smileAddress = body?.address || '';

  //     const submittedAddress = verification.smileRequest.address || '';

  //     return this.normalize(smileAddress) === this.normalize(submittedAddress);
  //   }

  private normalize(value: string): string {
    return value
      ?.trim()
      ?.toLowerCase()
      ?.replace(/\s+/g, '')
      ?.replace(/[^\w]/g, '');
  }
}

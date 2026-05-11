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
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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
   * Smile ID Callback Endpoint
   */
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

  @Auth(AuthType.None)
  @Post('/smile-callback')
  async handleSmileCallback(
    @Req() req: any,
    @Body() body: any,
  ) {
    console.log('--- SMILE ID CALLBACK HEADERS ---');

    const signature = body?.signature;

    const timestamp = body?.timestamp;

    console.log(signature, timestamp);

    // 1. Verify Signature
    if (!this.verifySmileSignature(timestamp, signature)) {
      throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
    }

    // 2. Extract Job ID (Smile uses PascalCase in callbacks)
    const jobId = body?.PartnerParams?.job_id || body?.partner_params?.job_id;
    if (!jobId)
      throw new HttpException('No job id found', HttpStatus.BAD_REQUEST);

    const verification = await this.verificationRepo.findOne({
      where: { smileJobId: jobId },
      relations: ['user'],
    });

    if (!verification)
      throw new HttpException('Record not found', HttpStatus.NOT_FOUND);

    // 3. Check Result Code
    // 0810: Approved/Passed, 1012: Document Verified
    const resultCode = body?.ResultCode || body?.result_code;
    const isApproved = ['0810', '1012'].includes(resultCode?.toString());

    verification.smileResponse = body;
    verification.smileJobComplete = true;

    if (isApproved) {
      verification.status = VerificationStatus.VERIFIED;
      verification.user.isKycVerified = true;
      await this.userRepo.save(verification.user);
    } else {
      verification.status = VerificationStatus.FAILED;
    }

    await this.verificationRepo.save(verification);

    // 4. Smile ID expects a 200 OK to stop retries
    return { success: true };
  }
}

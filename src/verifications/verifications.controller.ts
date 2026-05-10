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
   * Smile ID Callback Endpoint
   */
  @Post('/smile-callback')
  async handleSmileCallback(
    @Req() req: any,
    @Body() body: any,
    @Headers('signature') signature: string,
    @Headers('timestamp') timestamp: string,
  ) {
    console.log('Smile callback received');

    const rawBody = req.rawBody.toString();

    // ---------------------------------------------------
    // 1. VERIFY SIGNATURE
    // ---------------------------------------------------

    const isValidSignature = this.verifySmileSignature(
      rawBody,
      timestamp,
      signature,
    );

    if (!isValidSignature) {
      throw new HttpException(
        'Invalid Smile signature',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // ---------------------------------------------------
    // 2. EXTRACT JOB ID
    // ---------------------------------------------------

    const jobId = body?.PartnerParams?.job_id || body?.partner_params?.job_id;

    if (!jobId) {
      throw new HttpException('No job id found', HttpStatus.BAD_REQUEST);
    }

    // ---------------------------------------------------
    // 3. FIND VERIFICATION RECORD
    // ---------------------------------------------------

    const verification = await this.verificationRepo.findOne({
      where: {
        smileJobId: jobId,
      },
      relations: ['user'],
    });

    if (!verification) {
      throw new HttpException(
        'Verification record not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // ---------------------------------------------------
    // 4. SAVE CALLBACK RESPONSE
    // ---------------------------------------------------

    verification.smileResponse = body;
    verification.smileJobComplete = true;

    // ---------------------------------------------------
    // 5. CHECK RESULT
    // ---------------------------------------------------

    /**
     * Smile success codes
     *
     * 0810 => Valid ID
     * 1012 => Verification successful
     */

    const resultCode =
      body?.ResultCode || body?.result_code || body?.Result?.ResultCode;

    const success = resultCode === '0810' || resultCode === '1012';

    if (success) {
      verification.status = VerificationStatus.VERIFIED;

      verification.user.isKycVerified = true;

      await this.userRepo.save(verification.user);
    } else {
      verification.status = VerificationStatus.FAILED;
    }

    // ---------------------------------------------------
    // 6. SAVE FINAL STATUS
    // ---------------------------------------------------

    await this.verificationRepo.save(verification);

    return {
      success: true,
      message: 'Callback processed successfully',
    };
  }

  /**
   * Verify Smile ID Signature
   */
  private verifySmileSignature(
    body: any,
    timestamp: string,
    receivedSignature: string,
  ): boolean {
    try {
      // ---------------------------------------------------
      // OPTIONAL: PREVENT REPLAY ATTACKS
      // ---------------------------------------------------

      const now = Date.now();

      const requestTime = new Date(timestamp).getTime();

      const fiveMinutes = 5 * 60 * 1000;

      if (Math.abs(now - requestTime) > fiveMinutes) {
        console.log('Expired callback timestamp');

        return false;
      }

      // ---------------------------------------------------
      // RECREATE PAYLOAD
      // ---------------------------------------------------

      /**
       * Smile signs:
       *
       * timestamp + requestBody
       */

      const payload = `${timestamp}${JSON.stringify(body)}`;

      // ---------------------------------------------------
      // GENERATE HMAC SIGNATURE
      // ---------------------------------------------------

      const generatedSignature = crypto
        .createHmac('sha256', process.env.SMILE_API_KEY!)
        .update(payload)
        .digest('hex');

      // ---------------------------------------------------
      // COMPARE SIGNATURES
      // ---------------------------------------------------

      return crypto.timingSafeEqual(
        Buffer.from(generatedSignature),
        Buffer.from(receivedSignature),
      );
    } catch (error) {
      console.log('Signature verification error', error);

      return false;
    }
  }
}

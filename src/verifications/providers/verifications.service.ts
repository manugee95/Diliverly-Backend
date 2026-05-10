import { BadRequestException, Injectable } from '@nestjs/common';
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
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Upload document to S3
    const documentUrl = await this.s3Service.uploadFile(file);
    dto.documentUrl = documentUrl;

    const jobId = `KYC_${user.id}_${Date.now()}`;

    // Save FIRST
    const verification = this.verificationRepo.create({
      user,
      type:
        dto.idType === 'NIN' ? VerificationType.NIN : VerificationType.VOTER_ID,
      idNumber: dto.idNumber,
      status: VerificationStatus.PENDING,
      smileJobId: jobId,
      smileJobComplete: false,
    });

    await this.verificationRepo.save(verification);

    // Send to Smile
    const payload = {
      country: 'NG',
      id_type: dto.idType,
      id_number: dto.idNumber,
      callback_url: process.env.SMILE_CALLBACK_URL!,

      partner_params: {
        job_id: jobId,
        user_id: String(user.id),
      },
    };

    const result = await this.smileService.verifyKyc(payload);

    // Save request response
    verification.smileRequest = payload;
    verification.smileResponse = result;

    await this.verificationRepo.save(verification);

    return {
      message: 'Verification submitted successfully',
      verificationId: verification.id,
      status: verification.status,
    };
  }

  //   async verifyKyb(
  //     userId: number,
  //     dto: KybDto,
  //   ) {
  //     const user = await this.userRepo.findOne({
  //       where: { id: userId },
  //       relations: ['agent'],
  //     });

  //     if (!user) {
  //       throw new Error('User not found');
  //     }

  //     const payload = {
  //       country: 'NG',
  //       id_type: 'BUSINESS_REGISTRATION',
  //       id_number: dto.cacNumber,
  //       business_name: dto.businessName,
  //       image_url: dto.documentUrl,
  //     };

  //     const result = await this.smileService.verifyDocument(payload);

  //     const verified = result?.Result?.ResultCode === '0810';

  //     const verification = this.verificationRepo.create({
  //       user,
  //       type: VerificationType.CAC,
  //       businessName: dto.businessName,
  //       idNumber: dto.cacNumber,
  //       documentUrl: dto.documentUrl,
  //       smileResponse: result,
  //       status: verified
  //         ? VerificationStatus.VERIFIED
  //         : VerificationStatus.FAILED,
  //     });

  //     await this.verificationRepo.save(verification);

  //     if (verified) {
  //       user.agent.isKybVerified = true;
  //       await this.agentRepo.save(user.agent);
  //     }

  //     return verification;
  //   }
}

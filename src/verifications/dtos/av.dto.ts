import {
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export enum AdminVerificationAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class AdminVerificationDecisionDto {
  @IsEnum(AdminVerificationAction)
  action!: AdminVerificationAction;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
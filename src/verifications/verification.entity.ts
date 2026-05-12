import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { VerificationType } from './enums/verificationType.enum';
import { VerificationStatus } from './enums/verificationStatus.enum';

@Entity()
export class Verification {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  user!: User;

  @Column({
    type: 'enum',
    enum: VerificationType,
  })
  type!: VerificationType;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status!: VerificationStatus;

  // User input
  @Column({ nullable: true })
  idNumber?: string;

  @Column({ nullable: true })
  businessName?: string;

  // Uploaded document
  @Column({ nullable: true })
  documentUrl?: string;

  @Column({ nullable: true })
  documentType?: string;

  @Column({ nullable: true })
  smileJobId?: string;

  @Column({ type: 'jsonb', nullable: true })
  smileResponse?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  smileRequest?: any;

  @Column({ nullable: true })
  smileJobComplete?: boolean;

  @Column({ nullable: true })
  rejectionReason?: string;

  @Column({ nullable: true })
  reviewedByAdminId?: number;

  @Column({ nullable: true })
  reviewedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

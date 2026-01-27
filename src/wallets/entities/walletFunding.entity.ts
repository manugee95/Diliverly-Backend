import { User } from 'src/users/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FundingStatus } from '../enums/fundingStatus.enum';

@Entity()
export class WalletFunding {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Index({ unique: true })
  @Column({ length: 64 })
  reference: string; // internal ref

  @Column({ nullable: true })
  paystackReference?: string;

  @Column({ type: 'enum', enum: FundingStatus, default: FundingStatus.PENDING })
  status: FundingStatus;

  @Column({ type: 'jsonb', nullable: true })
  raw?: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import { User } from '../../users/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FundingStatus } from '../enums/fundingStatus.enum';

@Entity()
export class WalletFunding {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: number;

  @Column({ type: 'bigint', default: 0 })
  amount!: number;

  @Index({ unique: true })
  @Column({ length: 64 })
  reference!: string; // internal ref

  @Column({ nullable: true })
  paystackReference?: string;

  @Column({ type: 'enum', enum: FundingStatus, default: FundingStatus.PENDING })
  status!: FundingStatus;

  @Column({ type: 'jsonb', nullable: true })
  raw?: any;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

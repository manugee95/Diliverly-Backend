import { User } from 'src/users/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { KYCStatus } from '../enums/kycStatus.enum';
import { Agent_KYC } from './agent_kyc.entity';
import { Agent_Bank_Account } from './agent_bank_account.entity';
import { Quote } from 'src/quotes/entities/quote.entity';
import { Review } from 'src/reviews/review.entity';
import { OrderItem } from 'src/orders/entities/orderItem.entity';

@Entity()
export class Agent {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, (user) => user.agent, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn()
  user: User;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.agent, {
    nullable: false,
  })
  orderItems: OrderItem[];

  @Column({ nullable: true })
  businessName?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column('simple-array', { nullable: true })
  statesCovered?: string[];

  @Column({
    type: 'enum',
    enum: KYCStatus,
    default: KYCStatus.PENDING,
  })
  kycStatus: KYCStatus;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  rating_avg: number;

  @Column({ type: 'float', default: 0 })
  trust_score: number;

  @Column({ type: 'int', default: 0 })
  rating_count: number;

  @Column({ default: false })
  isVerified: boolean;

  @OneToOne(() => Agent_KYC, (kyc) => kyc.agent)
  @JoinColumn()
  kyc: Agent_KYC;

  @OneToOne(() => Agent_Bank_Account, (bank_account) => bank_account.agent, {
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  bank_account: Agent_Bank_Account;

  @OneToMany(() => Quote, (quote) => quote.agent)
  quotes: Quote[];

  @OneToMany(() => Review, (review) => review.agent)
  reviews: Review[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

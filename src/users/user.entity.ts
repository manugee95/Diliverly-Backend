import { Exclude } from 'class-transformer';
import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { UserStatus } from './enums/userStatus.enum';
import { Vendor } from 'src/vendor/vendor.entity';
import { Transaction } from 'src/transactions/transaction.entity';
import { Bank_Account } from 'src/bank-account/bank-account.entity';
import { Agent } from 'src/agent/agent.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: false })
  isAgent: boolean;

  @Column({ default: false })
  isVendor: boolean;

  @Column({ unique: true, type: 'varchar', length: 96 })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Exclude()
  password: string;

  @Column({ type: 'varchar', length: 96 })
  firstName: string;

  @Column({ type: 'varchar', length: 96 })
  lastName: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  phone?: string;

  @OneToOne(() => Agent, (agent) => agent.user)
  agent: Agent;

  @OneToOne(() => Vendor, (vendor) => vendor.user)
  vendor: Vendor;

  @Column({
    type: 'enum',
    enum: UserStatus,
  })
  status: UserStatus;

  @Column({ nullable: true })
  profileImageUrl?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  walletBalance: number;

  @OneToOne(() => Bank_Account, (bank_account) => bank_account.user, {
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  bank_account: Bank_Account;

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions: Transaction[];

  @Column({ type: 'varchar', length: 6, nullable: true })
  verificationCode?: string;

  @Column({ type: 'timestamp', nullable: true })
  codeExpiresAt?: Date;

  @Column({ nullable: true })
  resetCode?: string;

  @Column({ type: 'timestamptz', nullable: true })
  resetCodeExpiresAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

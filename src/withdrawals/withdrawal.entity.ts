import { User } from '../users/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { WithdrawalStatus } from './enums/withdrawalStatus.enum';
import { Transaction } from '../transactions/transaction.entity';

@Entity()
export class Withdrawal {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true })
  user: User;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column()
  reference: string;

  @Column({ nullable: true })
  paystackTransferCode: string;

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PROCESSING,
  })
  status: WithdrawalStatus;

  @OneToOne(() => Transaction, (transaction) => transaction.withdrawal, {
    nullable: true,
  })
  transaction: Transaction;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

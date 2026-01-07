import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { Agent } from './agent.entity';

@Entity()
export class Agent_Bank_Account {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Agent, (agent) => agent.bank_account, { onDelete: 'SET NULL' })
  agent: Agent;

  @Column({ nullable: true })
  bankName?: string;

  @Column({ nullable: true })
  bankCode?: string;

  @Column({ nullable: true })
  accountName?: string;

  @Column({ nullable: true })
  accountNumber?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

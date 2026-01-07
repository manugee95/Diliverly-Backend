import { User } from 'src/users/user.entity';
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
export class Agent_KYC {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Agent, (agent) => agent.kyc)
  agent: Agent;

  // Hashed identifiers (sensitive)
  @Column({ nullable: true, select: false })
  ninHash?: string;

  @Column({ nullable: true, select: false })
  bvnHash?: string;

  @Column({ nullable: true })
  kyc_provider_response: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

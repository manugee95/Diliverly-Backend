import { Entity } from 'typeorm';
import {
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Agent } from '../../agent/agent.entity';
import { ExtensionStatus } from '../enums/orderExtension.enum';

@Entity()
export class OrderTimeExtension {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Order)
  order!: Order;

  @ManyToOne(() => Agent)
  agent!: Agent;

  @Column()
  requestedHours!: number;

  @Column({ nullable: true })
  reason!: string;

  @Column({
    type: 'enum',
    enum: ExtensionStatus,
    default: ExtensionStatus.PENDING,
  })
  status!: ExtensionStatus;

  @CreateDateColumn()
  createdAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { Vendor } from '../../vendor/vendor.entity';
import { Agent } from '../../agent/agent.entity';
import { DisputeType } from '../enums/disputeType.enum';
import { DisputeStatus } from '../enums/disputeStatus.enum';
import { DisputeEvidence } from './disputeEvidence.entity';
import { DisputeMessage } from './disputeMessage.entity';

@Entity()
export class OrderDispute {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  order!: Order;

  @ManyToOne(() => Vendor, { nullable: true })
  openedByVendor?: Vendor | null;

  @ManyToOne(() => Agent, { nullable: true })
  openedByAgent?: Agent | null;

  @Column({
    type: 'enum',
    enum: DisputeType,
  })
  disputeType!: DisputeType;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status!: DisputeStatus;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ default: false })
  isResolved!: boolean;

  @Column({ nullable: true })
  resolution!: string;

  @Column({ nullable: true })
  resolvedByAdminId!: number;

  @OneToMany(() => DisputeMessage, (message) => message.dispute, {
    cascade: true,
  })
  messages!: DisputeMessage[];

  @OneToMany(() => DisputeEvidence, (evidence) => evidence.dispute, {
    cascade: true, nullable: true
  })
  evidences?: DisputeEvidence[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

import { Vendor } from '../../vendor/vendor.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RequestStatus } from '../enums/requestStatus.enum';
import { Delivery } from './delivery.entity';
import { Exclude } from 'class-transformer';
import { Quote } from '../../quotes/entities/quote.entity';
import { Order } from '../../orders/entities/order.entity';
import { Agent } from '../../agent/agent.entity';

@Entity()
@Index('idx_delivery_request_vendor', ['vendor'])
@Index('idx_delivery_request_status', ['status'])
@Index('idx_delivery_request_assigned_agent', ['assignedAgent'])
export class DeliveryRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Exclude()
  @ManyToOne(() => Vendor, (vendor) => vendor.delivery_request, {
    onDelete: 'CASCADE',
  })
  vendor: Vendor;

  @Column({
    type: 'varchar',
    length: 512,
    nullable: false,
  })
  title: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string;

  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    nullable: false,
    default: RequestStatus.OPEN,
  })
  status: RequestStatus;

  @OneToMany(() => Delivery, (delivery) => delivery.request, {
    cascade: ['insert'],
  })
  deliveries: Delivery[];

  @Column({ type: 'varchar', length: 512, default: 'a' }) 
  pickUpAddress: string;

  @ManyToOne(() => Agent, { nullable: true, onDelete: 'SET NULL' })
  assignedAgent: Agent;

  @Column({ default: false })
  isDirect: boolean;

  @OneToMany(() => Quote, (quote) => quote.request)
  quotes: Quote[];

  @OneToOne(() => Order, (order) => order.request)
  order: Order;

  @CreateDateColumn()
  createdAt: Date;
}

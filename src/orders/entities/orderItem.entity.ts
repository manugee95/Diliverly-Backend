import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Delivery } from 'src/delivery-requests/entities/delivery.entity';
import { DeliveryType } from 'src/delivery-requests/enums/deliveryType.enum';
import { OrderStatus } from '../enums/orderStatus.enum';
import { Agent } from 'src/agent/agent.entity';

@Entity()
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, (order) => order.items, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  order: Order;

  @ManyToOne(() => Agent, (agent) => agent.orderItems, { nullable: false })
  agent: Agent;

  @ManyToOne(() => Delivery, { onDelete: 'CASCADE', nullable: false })
  delivery: Delivery;

  @Column()
  itemName: string;

  @Column()
  quantity: number;

  @Column()
  buyerName: string;

  @Column()
  buyerPhone: string;

  @Column({ type: 'enum', enum: DeliveryType, nullable: true })
  deliveryType?: DeliveryType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  cost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  codAmount?: number;

  @Column({ nullable: true })
  paymentReceiptUrl?: string;

  @Column({ unique: true, nullable: true })
  deliveryPin?: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.IN_PROGRESS,
  })
  status: OrderStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

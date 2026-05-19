import { Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import {
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vendor } from '../../vendor/vendor.entity';
import { DeliveryRequest } from '../../delivery-requests/entities/delivery-request.entity';
import { OrderStatus } from '../enums/orderStatus.enum';
import { OrderItem } from './orderItem.entity';
import { Review } from '../../reviews/review.entity';

@Entity()
@Index('idx_order_vendor_status', ['vendor', 'status'])
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  reference!: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.orders, { nullable: false })
  vendor!: Vendor;

  @OneToOne(() => DeliveryRequest, (dr) => dr.order, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  request!: DeliveryRequest;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount!: number;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status!: OrderStatus;

  @OneToOne(() => Review, (review) => review.order)
  review!: Review;

  @Column({ type: 'timestamp', nullable: true })
  lastReminderSentAt?: Date;

  @Column({ default: false })
  deliveryDetailsProvided!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  startedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveryDeadline!: Date;

  @Column({ default: 0 })
  remainingExtensionHours!: number;

  @Column({ default: false })
  isExtended!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date;
}

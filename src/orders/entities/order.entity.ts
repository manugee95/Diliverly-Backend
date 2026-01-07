import { Entity, JoinColumn, OneToOne } from 'typeorm';
import {
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vendor } from 'src/vendor/vendor.entity';
import { DeliveryRequest } from 'src/delivery-requests/entities/delivery-request.entity';
import { OrderStatus } from '../enums/orderStatus.enum';
import { OrderItem } from './orderItem.entity';
import Joi from 'joi';
import { Review } from 'src/reviews/review.entity';

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  reference: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.orders, { nullable: false })
  vendor: Vendor;

  @OneToOne(() => DeliveryRequest, (dr) => dr.order, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  request: DeliveryRequest;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @OneToOne(() => Review, (review) => review.order)
  review: Review;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}

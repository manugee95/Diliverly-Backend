import { Agent } from '../agent/agent.entity';
import { Order } from '../orders/entities/order.entity';
import { Vendor } from '../vendor/vendor.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
  OneToOne,
  JoinColumn,
} from 'typeorm';

@Entity()
export class Review {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Check(`"rating" >= 1 AND "rating" <= 5`)
  rating!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.reviews, {
    onDelete: 'CASCADE',
  })
  vendor!: Vendor;

  @ManyToOne(() => Agent, (agent) => agent.reviews, {
    onDelete: 'CASCADE',
  })
  agent!: Agent;

  @OneToOne(() => Order, (order) => order.review, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  order!: Order;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

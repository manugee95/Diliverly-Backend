import { Agent } from 'src/agent/agent.entity';
import { Order } from 'src/orders/entities/order.entity';
import { OrderItem } from 'src/orders/entities/orderItem.entity';
import { Vendor } from 'src/vendor/vendor.entity';
import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
  ManyToOne,
} from 'typeorm';
import { EscrowStatus } from './enums/escrowStatus.enum';

@Entity()
export class Escrow {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column()
  reference: string; // ESCROW-OI-<orderItemId>

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  order: Order;

  @OneToOne(() => OrderItem, { onDelete: 'CASCADE' })
  @JoinColumn()
  orderItem: OrderItem;

  @ManyToOne(() => Vendor)
  vendor: Vendor;

  @ManyToOne(() => Agent)
  agent: Agent;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string; // equals orderItem.cost

  @Column({ type: 'enum', enum: EscrowStatus, default: EscrowStatus.HELD })
  status: EscrowStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Quote } from './quote.entity';
import { Delivery } from '../../delivery-requests/entities/delivery.entity';


@Entity('delivery_cost')
export class DeliveryCost {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Quote, (quote) => quote.deliveryCost, { nullable: false })
  quote: Quote;

  @ManyToOne(() => Delivery, (delivery) => delivery.deliveryCost, { nullable: false })
  delivery: Delivery;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  cost: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

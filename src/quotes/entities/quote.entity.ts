import { DeliveryRequest } from '../../delivery-requests/entities/delivery-request.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { QuoteStatus } from '../enums/quoteStatus.enum';
import { DeliveryCost } from './deliveryCost.entity';
import { Agent } from '../../agent/agent.entity';

@Entity('quote')
@Index('idx_quote_agent', ['agent'])
@Index('idx_quote_status', ['status'])
@Index('idx_quote_request_status', ['request', 'status'])
export class Quote {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Agent, (agent) => agent.quotes, { nullable: false })
  agent: Agent;

  @ManyToOne(() => DeliveryRequest, (request) => request.quotes, {
    nullable: false,
  })
  request: DeliveryRequest;

  @OneToMany(() => DeliveryCost, (dq) => dq.quote, { cascade: true })
  deliveryCost: DeliveryCost[];

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'enum', enum: QuoteStatus, default: QuoteStatus.PENDING })
  status: QuoteStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


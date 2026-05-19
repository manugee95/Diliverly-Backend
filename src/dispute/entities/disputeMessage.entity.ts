import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderDispute } from './dispute.entity';

@Entity()
export class DisputeMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => OrderDispute, (dispute) => dispute.messages, {
    onDelete: 'CASCADE',
  })
  dispute!: OrderDispute;

  @Column()
  senderRole!: string;

  @Column()
  senderId!: number;

  @Column({ type: 'text' })
  message!: string;

  @Column({ nullable: true })
  attachmentUrl!: string;

  @Column({ nullable: true })
  attachmentType!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

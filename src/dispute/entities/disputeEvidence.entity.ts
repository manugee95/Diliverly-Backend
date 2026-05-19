import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderDispute } from './dispute.entity';

@Entity()
export class DisputeEvidence {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(
    () => OrderDispute,
    (dispute) => dispute.evidences,
    {
      onDelete: 'CASCADE',
    },
  )
  dispute!: OrderDispute;

  @Column()
  fileUrl!: string;

  @Column()
  fileType!: string;

  @Column()
  uploadedBy!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeliveryRequest } from './delivery-request.entity';
import { DeliveryType } from '../enums/deliveryType.enum';
import { DeliveryCost } from '../../quotes/entities/deliveryCost.entity';

@Entity()
export class Delivery {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => DeliveryRequest, (request) => request.deliveries, {
    onDelete: 'CASCADE', nullable: false,
  })
  request!: DeliveryRequest;

  @Column({ type: 'varchar', length: 512 })
  address!: string;

  @Column({
    type: 'enum',
    enum: DeliveryType,
    nullable: true,
  })
  deliveryType?: DeliveryType;

  @OneToMany(() => DeliveryCost, (dc) => dc.delivery, { cascade: true })
  deliveryCost!: DeliveryCost[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

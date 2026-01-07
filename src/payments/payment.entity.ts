import { DeliveryRequest } from 'src/delivery-requests/entities/delivery-request.entity';
import { Vendor } from 'src/vendor/vendor.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PaymentStatus } from './enums/paymentStatus.enum';
import { PaymentMethod } from './enums/paymentMethod.enum';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DeliveryRequest, { onDelete: 'CASCADE' })
  deliveryRequest: DeliveryRequest;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  vendor: Vendor;

  @Column({ type: 'float', nullable: false })
  amount: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ nullable: true })
  reference: string; // paystack reference

  @Column({ nullable: true })
  gatewayResponse: string; // raw JSON response or short msg

  @Column({ nullable: true, type: 'float' })
  walletDeduction: number;

  @Column({ nullable: true, type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @CreateDateColumn()
  createdAt: Date;
}

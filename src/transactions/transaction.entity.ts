import { User } from 'src/users/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TransactionType } from './enums/transactionType.enum';
import { TransactionStatus } from './enums/transactionStatus.enum';
import { OrderItem } from 'src/orders/entities/orderItem.entity';
import { Withdrawal } from 'src/withdrawals/withdrawal.entity';
import { Order } from 'src/orders/entities/order.entity';

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  reference: string;

  @Column({ type: 'enum', enum: TransactionStatus })
  status: TransactionStatus;

  @OneToOne(() => Order, { nullable: true })
  order: Order;

  @ManyToOne(() => OrderItem, { nullable: true })
  orderItem: OrderItem;

  @OneToOne(() => Withdrawal, (withdrawal) => withdrawal.transaction, {
    nullable: true,
  })
  withdrawal: Withdrawal;

  @CreateDateColumn()
  createdAt: Date;
}

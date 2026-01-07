import { DeliveryRequest } from 'src/delivery-requests/entities/delivery-request.entity';
import { Order } from 'src/orders/entities/order.entity';
import { Review } from 'src/reviews/review.entity';
import { User } from 'src/users/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Vendor {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, (user) => user.vendor, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn()
  user: User;

  @OneToMany(() => DeliveryRequest, (request) => request.vendor)
  delivery_request: DeliveryRequest[];

  @OneToMany(()=> Order, (order) => order.vendor)
  orders: Order[];

  @Column({ nullable: true })
  businessName?: string;

  @Column({ nullable: true })
  address?: string;

  @OneToMany(() => Review, (review) => review.vendor)
  reviews: Review[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

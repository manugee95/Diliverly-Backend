import { User } from 'src/users/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Quote } from 'src/quotes/entities/quote.entity';
import { Review } from 'src/reviews/review.entity';
import { OrderItem } from 'src/orders/entities/orderItem.entity';
import { FavoriteAgent } from 'src/favorites/favorite-agent.entity';

@Entity()
export class Agent {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, (user) => user.agent, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn()
  user: User;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.agent, {
    nullable: false,
  })
  orderItems: OrderItem[];

  @Column({ nullable: true })
  businessName?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column('simple-array', { nullable: true })
  statesCovered?: string[];

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  rating_avg: number;

  @Column({ type: 'float', default: 0 })
  trust_score: number;

  @Column({ type: 'int', default: 0 })
  rating_count: number;

  @Column({ type: 'int', default: 0 })
  total_deliveries: number;

  @Column({ default: false })
  isVerified: boolean;

  @OneToMany(() => Quote, (quote) => quote.agent)
  quotes: Quote[];

  @OneToMany(() => Review, (review) => review.agent)
  reviews: Review[];

  @OneToMany(() => FavoriteAgent, (fav) => fav.agent)
  favoriteByVendors: FavoriteAgent[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

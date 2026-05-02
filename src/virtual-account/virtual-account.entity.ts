import { User } from '../users/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class VirtualAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: number;

  @Column()
  customerCode: string;

  @Column()
  accountNumber: string;

  @Column()
  bankName: string;

  @Column()
  accountName: string;

  @Column({ nullable: true })
  paystackDvaId: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
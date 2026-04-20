import { User } from '../users/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';

@Entity()
export class Bank_Account {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, (user) => user.bank_account, {
    onDelete: 'SET NULL',
  })
  user: User;

  @Column({ nullable: true })
  bankName?: string;

  @Column({ nullable: true })
  bankCode?: string;

  @Column({ nullable: true })
  accountName?: string;

  @Column({ nullable: true })
  accountNumber?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import { User } from 'src/users/user.entity';
import { TransactionType } from '../enums/transactionType.enum';
import { OrderItem } from 'src/orders/entities/orderItem.entity';
import { TransactionStatus } from '../enums/transactionStatus.enum';
import { Withdrawal } from 'src/withdrawals/withdrawal.entity';

export class CreateTransactionDto {
  user: User;
  type: TransactionType;
  amount: number;
  description?: string;
  orderItem?: OrderItem;
  status?: TransactionStatus;
  reference: string;
  withdrawal?: Withdrawal;
}

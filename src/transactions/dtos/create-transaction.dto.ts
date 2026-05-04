import { User } from '../../users/user.entity';
import { TransactionType } from '../enums/transactionType.enum';
import { OrderItem } from '../../orders/entities/orderItem.entity';
import { TransactionStatus } from '../enums/transactionStatus.enum';
import { Withdrawal } from '../../withdrawals/withdrawal.entity';
import { Order } from '../../orders/entities/order.entity';

export class CreateTransactionDto {
  user: User;
  type: TransactionType;
  amount: number;
  description?: string;
  order?: Order;
  orderItem?: OrderItem;
  status?: TransactionStatus;
  reference: string;
  withdrawal?: Withdrawal;
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { OrderStatus } from '../enums/orderStatus.enum';

@Injectable()
export class OrderschedulerProvider {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  @Cron('*/5 * * * *') // every 5 minutes
  async handleOverdueOrders() {
    const now = new Date(); 

    // const overdueOrders = await this.orderRepo.find({
    //   where: {
    //     status: OrderStatus.ACTIVE,
    //   },
    // });

    const overdueOrders = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.status = :status', {
        status: OrderStatus.ACTIVE,
      })
      .andWhere('order.deliveryDeadline < :now', {
        now: new Date(),
      })
      .getMany();

    for (const order of overdueOrders) {
      if (order.deliveryDeadline && now > order.deliveryDeadline) {
        order.status = OrderStatus.OVERDUE;

        await this.orderRepo.save(order);
      }
    }
  }
}

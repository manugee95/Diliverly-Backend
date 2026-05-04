import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './providers/reviews.service';
import { Order } from '../orders/entities/order.entity';
import { Vendor } from '../vendor/vendor.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './review.entity';
import { PaginationModule } from '../common/pagination/pagination.module';
import { Agent } from '../agent/agent.entity';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService],
  imports: [
    TypeOrmModule.forFeature([Review, Agent, Order, Vendor]),
    PaginationModule,
    MailerModule,
  ],
})
export class ReviewsModule {}

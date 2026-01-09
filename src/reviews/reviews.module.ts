import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './providers/reviews.service';
import { Order } from 'src/orders/entities/order.entity';
import { Vendor } from 'src/vendor/vendor.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './review.entity';
import { PaginationModule } from 'src/common/pagination/pagination.module';
import { Agent } from 'src/agent/agent.entity';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService],
  imports: [
    TypeOrmModule.forFeature([Review, Agent, Order, Vendor]),
    PaginationModule,
  ],
})
export class ReviewsModule {}

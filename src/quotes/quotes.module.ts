import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './providers/quotes.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote } from './entities/quote.entity';
import { DeliveryCost } from './entities/deliveryCost.entity';
import { DeliveryRequestsModule } from 'src/delivery-requests/delivery-requests.module';
import { DeliveryRequest } from 'src/delivery-requests/entities/delivery-request.entity';
import { AgentModule } from 'src/agent/agent.module';
import { VendorModule } from 'src/vendor/vendor.module';
import { Vendor } from 'src/vendor/vendor.entity';
import { CacheModule } from '@nestjs/cache-manager';
import { PaginationModule } from 'src/common/pagination/pagination.module';
import { Agent } from 'src/agent/agent.entity';
import { MailerModule } from 'src/mailer/mailer.module';
import { QuotePaymentService } from './providers/quote-payment.service';
import { WalletsModule } from 'src/wallets/wallets.module';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { ReferenceModule } from 'src/common/reference/reference.module';
import { DashboardOverviewModule } from 'src/dashboard-overview/dashboard-overview.module';
import { QuotesCacheProvider } from './providers/quotes.provider';
import { redisProvider } from 'src/common/providers/redis.provider';

@Module({
  controllers: [QuotesController],
  providers: [QuotesService, QuotePaymentService, QuotesCacheProvider, redisProvider],
  imports: [
    TypeOrmModule.forFeature([
      Quote,
      DeliveryCost,
      DeliveryRequest,
      Agent,
      Vendor,
    ]),
    DeliveryRequestsModule,
    AgentModule,
    VendorModule,
    PaginationModule,
    MailerModule,
    WalletsModule,
    TransactionsModule,
    ReferenceModule,
    DashboardOverviewModule,
    DeliveryRequestsModule,
    CacheModule.register()
  ],
})
export class QuotesModule {}

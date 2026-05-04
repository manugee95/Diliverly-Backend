import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './providers/quotes.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote } from './entities/quote.entity';
import { DeliveryCost } from './entities/deliveryCost.entity';
import { DeliveryRequestsModule } from '../delivery-requests/delivery-requests.module';
import { DeliveryRequest } from '../delivery-requests/entities/delivery-request.entity';
import { AgentModule } from '../agent/agent.module';
import { VendorModule } from '../vendor/vendor.module';
import { Vendor } from '../vendor/vendor.entity';
import { CacheModule } from '@nestjs/cache-manager';
import { PaginationModule } from '../common/pagination/pagination.module';
import { Agent } from '../agent/agent.entity';
import { MailerModule } from '../mailer/mailer.module';
import { QuotePaymentService } from './providers/quote-payment.service';
import { WalletsModule } from '../wallets/wallets.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { DashboardOverviewModule } from '../dashboard-overview/dashboard-overview.module';
import { QuotesCacheProvider } from './providers/quotes.provider';
import { redisProvider } from '../common/providers/redis.provider';
import { CurrencyConvertProvider } from '../common/providers/currency-convert.provider';

@Module({
  controllers: [QuotesController],
  providers: [
    QuotesService,
    QuotePaymentService,
    QuotesCacheProvider,
    redisProvider,
    CurrencyConvertProvider,
  ],
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
    DashboardOverviewModule,
    DeliveryRequestsModule,
    CacheModule.register(),
  ],
})
export class QuotesModule {}

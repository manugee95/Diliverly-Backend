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
import { PaymentsModule } from 'src/payments/payments.module';
import { Payment } from 'src/payments/payment.entity';

@Module({
  controllers: [QuotesController],
  providers: [QuotesService, QuotePaymentService],
  imports: [
    TypeOrmModule.forFeature([
      Quote,
      DeliveryCost,
      DeliveryRequest,
      Agent,
      Vendor,
      Payment
    ]),
    DeliveryRequestsModule,
    AgentModule,
    VendorModule,
    PaginationModule,
    MailerModule,
    WalletsModule,
    TransactionsModule,
    ReferenceModule,
    CacheModule.register()
  ],
})
export class QuotesModule {}

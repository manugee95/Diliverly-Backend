import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './providers/payments.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryRequest } from 'src/delivery-requests/entities/delivery-request.entity';
import { Vendor } from 'src/vendor/vendor.entity';
import { DeliveryRequestsModule } from 'src/delivery-requests/delivery-requests.module';
import { VendorModule } from 'src/vendor/vendor.module';
import { Payment } from './payment.entity';
import { ReferenceModule } from 'src/common/reference/reference.module';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { MailerModule } from 'src/mailer/mailer.module';
import { User } from 'src/users/user.entity';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService],
  imports: [
    TypeOrmModule.forFeature([DeliveryRequest, Vendor, Payment, User]),
    DeliveryRequestsModule,
    VendorModule,
    ReferenceModule,
    TransactionsModule,
    MailerModule
  ],
})
export class PaymentsModule {}

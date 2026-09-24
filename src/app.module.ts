import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import appConfig from './config/app.config';
import { PaginationModule } from './common/pagination/pagination.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationGuard } from './auth/guards/authentication/authentication.guard';
import { AccessTokenGuard } from './auth/guards/access-token/access-token.guard';
import jwtConfig from './auth/config/jwt.config';
import { JwtModule } from '@nestjs/jwt';
import { AgentModule } from './agent/agent.module';
import { VendorModule } from './vendor/vendor.module';
import { DeliveryRequestsModule } from './delivery-requests/delivery-requests.module';
import { QuotesModule } from './quotes/quotes.module';
import { OrdersModule } from './orders/orders.module';
import { redisProvider } from './common/providers/redis.provider';
import { CacheService } from './common/providers/cache.service';
import { RedisCacheModule } from './rediscache/rediscache.module';
import { MailerModule } from './mailer/mailer.module';
import { ReviewsModule } from './reviews/reviews.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { HealthModule } from './health/health.module';
import { BankAccountModule } from './bank-account/bank-account.module';
import { WalletsModule } from './wallets/wallets.module';
import { EscrowModule } from './escrow/escrow.module';
import { PaystackModule } from './paystack/paystack.module';
import { FavoritesModule } from './favorites/favorites.module';
import { DashboardOverviewModule } from './dashboard-overview/dashboard-overview.module';
import { CurrencyConvertProvider } from './common/providers/currency-convert.provider';
import { VirtualAccountModule } from './virtual-account/virtual-account.module';
import { WebhookModule } from './webhook/webhook.module';
import { S3Module } from './s3/s3.module';
import { VerificationsModule } from './verifications/verifications.module';
import { DisputeModule } from './dispute/dispute.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.development',
      load: [appConfig],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,

      autoLoadEntities: true,
      synchronize: false,
      ssl: false,

      extra: {
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        keepAlive: true,
      },

      retryAttempts: 5,
      retryDelay: 3000,
    }),
    UsersModule,
    PaginationModule,
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    AgentModule,
    VendorModule,
    DeliveryRequestsModule,
    QuotesModule,
    OrdersModule,
    RedisCacheModule,
    MailerModule,
    ReviewsModule,
    TransactionsModule,
    ScheduleModule.forRoot(),
    WithdrawalsModule,
    HealthModule,
    BankAccountModule,
    WalletsModule,
    EscrowModule,
    PaystackModule,
    FavoritesModule,
    DashboardOverviewModule,
    VirtualAccountModule,
    WebhookModule,
    S3Module,
    VerificationsModule,
    DisputeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    AccessTokenGuard,
    redisProvider,
    CacheService,
    CurrencyConvertProvider,
  ],
  exports: [CacheService, redisProvider],
})
export class AppModule {}

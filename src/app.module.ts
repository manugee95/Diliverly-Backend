import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
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
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { redisProvider } from './common/providers/redis.provider';
import { CacheService } from './common/providers/cache.service';
import { RedisCacheModule } from './rediscache/rediscache.module';
import { MailerModule } from './mailer/mailer.module';
import { ReviewsModule } from './reviews/reviews.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PayoutModule } from './payout/payout.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ReferenceModule } from './common/reference/reference.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { HealthModule } from './health/health.module';

const ENV = process.env.NODE_ENV;

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: !ENV ? '.env' : `.env.${ENV}`,
      load: [appConfig, databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProd = configService.get<boolean>('appConfig.isProduction');

        return {
          type: 'postgres',
          autoLoadEntities: true,
          synchronize: !isProd,
          logging: !isProd,

          host: configService.get('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get('database.user'),
          password: configService.get('database.password'),
          database: configService.get('database.name'),

          extra: {
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            keepAlive: true,
          },

          retryAttempts: 5,
          retryDelay: 3000,

          ssl: isProd ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    UsersModule,
    PaginationModule,
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    AgentModule,
    VendorModule,
    DeliveryRequestsModule,
    QuotesModule,
    PaymentsModule,
    OrdersModule,
    RedisCacheModule,
    MailerModule,
    ReviewsModule,
    TransactionsModule,
    PayoutModule,
    ScheduleModule.forRoot(),
    ReferenceModule,
    WithdrawalsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    AccessTokenGuard,
    redisProvider,
    CacheService,
  ],
  exports: [CacheService, redisProvider],
})
export class AppModule {}

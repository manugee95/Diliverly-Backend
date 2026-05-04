import { Module } from '@nestjs/common';
import { VendorController } from './vendor.controller';
import { VendorService } from './providers/vendor.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vendor } from './vendor.entity';
import { UsersModule } from '../users/users.module';
import { PaginationProvider } from '../common/pagination/providers/pagination.provider';
import { User } from '../users/user.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [VendorController],
  providers: [VendorService, PaginationProvider],
  imports: [
    TypeOrmModule.forFeature([Vendor, User]),
    UsersModule,
    AuthModule,
  ],
})
export class VendorModule {}

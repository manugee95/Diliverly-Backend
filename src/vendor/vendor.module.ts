import { forwardRef, Module } from '@nestjs/common';
import { VendorController } from './vendor.controller';
import { VendorService } from './providers/vendor.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vendor } from './vendor.entity';
import { UsersModule } from 'src/users/users.module';
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider';
import { User } from 'src/users/user.entity';
import { AuthModule } from 'src/auth/auth.module';
import { AccessTokenGuard } from 'src/auth/guards/access-token/access-token.guard';

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

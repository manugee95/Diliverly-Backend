import { Module } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './providers/favorites.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteAgent } from './favorite-agent.entity';
import { VendorModule } from '../vendor/vendor.module';
import { AgentModule } from '../agent/agent.module';
import { Vendor } from '../vendor/vendor.entity';
import { Agent } from '../agent/agent.entity';
import { PaginationModule } from '../common/pagination/pagination.module';
import { FavoritesCacheProvider } from './providers/favorites.provider';
import { redisProvider } from '../common/providers/redis.provider';

@Module({
  controllers: [FavoritesController],
  providers: [FavoritesService, FavoritesCacheProvider, redisProvider],
  imports: [
    TypeOrmModule.forFeature([FavoriteAgent, Vendor, Agent]),
    VendorModule,
    AgentModule,
    PaginationModule,
  ],
})
export class FavoritesModule {}

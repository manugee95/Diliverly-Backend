import { Module } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './providers/favorites.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteAgent } from './favorite-agent.entity';
import { VendorModule } from 'src/vendor/vendor.module';
import { AgentModule } from 'src/agent/agent.module';
import { Vendor } from 'src/vendor/vendor.entity';
import { Agent } from 'src/agent/agent.entity';
import { PaginationModule } from 'src/common/pagination/pagination.module';
import { FavoritesCacheProvider } from './providers/favorites.provider';
import { redisProvider } from 'src/common/providers/redis.provider';

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

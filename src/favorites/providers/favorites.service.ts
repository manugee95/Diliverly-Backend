import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor } from 'src/vendor/vendor.entity';
import { FavoriteAgent } from '../favorite-agent.entity';
import { Agent } from 'src/agent/agent.entity';
import { GetFavoritesDto } from '../dtos/get-favorite.dto';
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface';
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider';
import { FavoritesCacheProvider } from './favorites.provider';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(FavoriteAgent)
    private favRepo: Repository<FavoriteAgent>,

    @InjectRepository(Vendor)
    private vendorRepo: Repository<Vendor>,

    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,

    /**
     * Injecting Pagination Provider
     */
    private readonly paginationProvider: PaginationProvider,

    /**
     * Injecting Favorites Cache Provider
     */
    private readonly favoritesCacheProvider: FavoritesCacheProvider,
  ) {}

  // Add agent to favorites
  async addFavorite(userId: number, agentId: number) {
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const agent = await this.agentRepo.findOne({
      where: { id: agentId },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    const existing = await this.favRepo.findOne({
      where: { vendor: { id: vendor.id }, agent: { id: agent.id } },
    });

    if (existing) {
      throw new BadRequestException('Agent already in favorites');
    }

    const fav = this.favRepo.create({ vendor, agent });

    await this.favoritesCacheProvider.invalidateVendorFavorites(vendor.id);

    return this.favRepo.save(fav);
  }

  // Remove agent from favorites
  async removeFavorite(userId: number, agentId: number) {
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const fav = await this.favRepo.findOne({
      where: { vendor: { id: vendor.id }, agent: { id: agentId } },
    });

    if (!fav) {
      throw new NotFoundException('Favorite agent not found');
    }

    await this.favRepo.remove(fav);

    await this.favoritesCacheProvider.invalidateVendorFavorites(vendor.id);

    return { message: 'Agent removed from favorites' };
  }

  // Get all favorite agents (for quick request sending) USING Pagination

  // async getFavorites(
  //   userId: number,
  //   dto: GetFavoritesDto,
  // ): Promise<Paginated<FavoriteAgent>> {
  //   const vendor = await this.vendorRepo.findOne({
  //     where: { user: { id: userId } },
  //   });
  //   if (!vendor) throw new NotFoundException('Vendor not found');

  //   const favorites = await this.paginationProvider.paginateQuery(
  //     {
  //       page: dto.page || 1,
  //       limit: dto.limit || 10,
  //     },
  //     this.favRepo,
  //     {
  //       where: { vendor: { id: vendor.id } },
  //       relations: ['agent', 'agent.user'],
  //       order: { createdAt: 'DESC' },
  //     },
  //   );

  //   return favorites;
  // }

  async getFavorites(
    userId: number,
    dto: GetFavoritesDto,
  ): Promise<Paginated<FavoriteAgent>> {
    const vendor = await this.vendorRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!vendor) throw new NotFoundException('Vendor not found');

    const page = dto.page || 1;
    const limit = dto.limit || 10;

    // Try cache
    const cached = await this.favoritesCacheProvider.getVendorFavorites(
      vendor.id,
      page,
      limit,
    );

    if (cached) return cached as Paginated<FavoriteAgent>;

    // Fetch from DB
    const favorites = await this.paginationProvider.paginateQuery(
      { page, limit },
      this.favRepo,
      {
        where: { vendor: { id: vendor.id } },
        relations: ['agent', 'agent.user'],
        order: { createdAt: 'DESC' },
      },
    );

    // Cache result
    await this.favoritesCacheProvider.setVendorFavorites(
      vendor.id,
      page,
      limit,
      favorites,
    );

    return favorites;
  }
}

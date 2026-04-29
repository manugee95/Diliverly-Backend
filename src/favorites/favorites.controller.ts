import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FavoritesService } from './providers/favorites.service';
import { FavoriteAgentDto } from './dtos/favorite-agent.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VendorGuard } from 'src/auth/guards/roles/vendor.guard';
import { GetFavoritesDto } from './dtos/get-favorite.dto';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favService: FavoritesService) {}

  @ApiOperation({
    summary: 'Add an agent to favorites',
  })
  @ApiResponse({
    status: 201,
    description: 'Agent added to favorites successfully.',
  })
  @UseGuards(VendorGuard)
  @Post()
  addFavorite(@Req() req, @Body() dto: FavoriteAgentDto) {
    return this.favService.addFavorite(req.user.id, dto.agentId);
  }

  @ApiOperation({
    summary: 'Remove an agent from favorites',
  })
  @ApiResponse({
    status: 201,
    description: 'Agent removed from favorites successfully.',
  })
  @UseGuards(VendorGuard)
  @Delete()
  removeFavorite(@Req() req, @Body() dto: FavoriteAgentDto) {
    return this.favService.removeFavorite(req.user.id, dto.agentId);
  }

  @ApiOperation({
    summary: 'Get all favorite agents',
  })
  @ApiResponse({
    status: 201,
    description: 'Favorite agents fetched successfully.',
  })
  @UseGuards(VendorGuard)
  @Get()
  getFavorites(@Req() req, @Query() dto: GetFavoritesDto) {
    return this.favService.getFavorites(req.user.id, dto);
  }

  @ApiOperation({
    summary: 'Check if an agent is in favorites',
  })
  @ApiResponse({
    status: 200,
    description: 'Favorite status fetched successfully.',
  })
  @UseGuards(VendorGuard)
  @Get('is-favorite')
  isFavorite(@Req() req, @Query('agentId') agentId: number) {
    return this.favService.isFavorite(req.user.id, agentId);
  }
}

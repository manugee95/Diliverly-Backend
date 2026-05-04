import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { VendorService } from './providers/vendor.service';
import { CreateVendorDto } from './dtos/create-vendor.dto';
import { GetVendorsDto } from './dtos/get-vendors.dto';
import { VendorGuard } from '../auth/guards/roles/vendor.guard';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

@Controller('vendor')
export class VendorController {
  constructor(
    /**
     * Inject Vendor Service
     */
    private readonly vendorService: VendorService,
  ) {}

  /**
   * Endpoint to create or update a new vendor profile
   */
  @ApiOperation({
    summary: 'Create or update vendor profile',
  })
  @ApiResponse({
    status: 201,
    description: 'Vendor profile updated successfully.',
  })
  @UseGuards(VendorGuard)
  @Patch('/profile')
  public createOrUpdateVendorProfile(@Body() dto: CreateVendorDto, @Req() req) {
    const userId = req.user.id;
    return this.vendorService.createOrUpdateVendorProfile(userId, dto);
  }

  /**
   * Endpoint to get vendor profile
   */
  @ApiOperation({
    summary: 'Get vendor profile',
  })
  @ApiResponse({
    status: 200,
    description: 'Vendor profile fetched successfully.',
  })
  @UseGuards(VendorGuard)
  @Get('/profile')
  public getVendorProfile(@Req() req) {
    const userId = req.user.id;
    return this.vendorService.getVendorProfile(userId);
  }

  /**
   * Endpoint to view an vendor profile
   */
  @ApiOperation({
    summary: 'Get all vendors or a specific vendor by Id',
  })
  @ApiResponse({
    status: 200,
    description: 'Vendors fetched successfully.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    required: false,
    description: 'The Vendor Id',
    example: 5,
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
    description: 'The number of entries returned per query',
    example: 10,
  })
  @ApiQuery({
    name: 'page',
    type: 'number',
    required: false,
    description: 'The page number returned per query',
    example: 1,
  })
  @Get('/{:vendorId}')
  public getAllVendors(
    @Param('vendorId') vendorId: number,
    @Query() vendorQuery: GetVendorsDto,
  ) {
    return this.vendorService.getAllVendors(vendorId, vendorQuery);
  }
}

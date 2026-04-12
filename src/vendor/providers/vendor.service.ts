import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Vendor } from '../vendor.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider';
import { CreateVendorDto } from '../dtos/create-vendor.dto';
import { GetVendorsDto } from '../dtos/get-vendors.dto';
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface';
import { UpdateVendorDto } from '../dtos/patch-vendor.dto';

@Injectable()
export class VendorService {
  agentRepository: any;
  constructor(
    /**
     * Injecting Vendor Repository
     */
    @InjectRepository(Vendor)
    private readonly vendorRepository: Repository<Vendor>,

    /**
     * Injecting User Repository
     */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    /**
     * Inject Pagination Provider
     */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Method to create or update a vendor profile
   */
  async createOrUpdateVendorProfile(
    userId: number,
    dto: CreateVendorDto,
  ): Promise<Vendor> {
    const { businessName, address } = dto;
    // Ensure user exists & is a vendor
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if vendor profile already exists
    let vendor = await this.vendorRepository.findOne({
      where: { user: { id: userId } },
    });

    if (vendor) {
      // Update existing profile
      Object.assign(vendor, {
        businessName: businessName || vendor.businessName,
        address: address || vendor.address,
      });
    } else {
      // Create new profile
      vendor = this.vendorRepository.create({
        user: { id: userId },
        businessName,
        address,
      });
    }

    // Update user's isVendor if creating a new vendor profile
    if (!vendor.id) {
      user.isVendor = true;
      await this.userRepository.save(user);
    }

    return await this.vendorRepository.save(vendor);
  }

  /**
   * Method to get vendor profile by user ID
   */
  async getVendorProfile(userId: number): Promise<Vendor> {
    const vendor = await this.vendorRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!vendor) throw new NotFoundException('Vendor profile not found');
    return vendor;
  }

  /**
   * Method to get all vendors or a specific vendor by ID
   */
  async getAllVendors(
    vendorId: number,
    vendorQuery: GetVendorsDto,
  ): Promise<Paginated<Vendor> | Vendor[]> {
    if (vendorId) {
      let vendor: Vendor | null;
      try {
        vendor = await this.vendorRepository.findOne({
          where: { id: vendorId },
        });
      } catch (error) {
        console.error('Error fetching users:', error);
        throw new InternalServerErrorException('Failed to find vendor');
      }

      if (!vendor) {
        throw new NotFoundException('vendor not found');
      }

      // If a specific user ID is provided, return that user
      return [vendor];
    }

    let vendors = await this.paginationProvider.paginateQuery(
      {
        page: vendorQuery.page || 1,
        limit: vendorQuery.limit || 10,
      },
      this.vendorRepository,
      {
        order: { createdAt: 'ASC' },
      },
    );

    // If no user ID is provided, return all vendors
    return vendors;
  }

  /**
   * Method to update a vendor profile
   */
  async updateVendorProfile(
    userId: number,
    dto: CreateVendorDto,
  ): Promise<Vendor> {
    const { businessName, address } = dto;

    // Ensure user exists & is a vendor
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isVendor) {
      throw new BadRequestException('User is not registered as a vendor');
    }

    // Fetch existing vendor profile
    const vendor = await this.vendorRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }

    // Update only provided fields
    Object.assign(vendor, {
      ...(businessName && { businessName }),
      ...(address && { address }),
    });

    return await this.vendorRepository.save(vendor);
  }
}

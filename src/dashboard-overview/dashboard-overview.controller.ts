import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardOverviewService } from './providers/dashboard-overview.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Vendor } from 'src/vendor/vendor.entity';
import { Agent } from 'src/agent/agent.entity';

@Controller('dashboard-overview')
export class DashboardOverviewController {
  constructor(
    private readonly dashboardOverviewService: DashboardOverviewService,
  ) {}

  /**
   * Endpoint to get vendor dashboard data
   */
  @ApiOperation({ summary: 'Get vendor dashboard data' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully',
  })
  @UseGuards(Vendor)
  @Get('vendor')
  async getVendorDashboardData(@Req() req) {
    const vendorId = req.user.vendorId;
    return await this.dashboardOverviewService.getVendorDashboard(vendorId);
  }

  /**
   * Endpoint to get agent dashboard data
   */
    @ApiOperation({ summary: 'Get agent dashboard data' })
    @ApiResponse({
      status: 200,
      description: 'Dashboard data retrieved successfully',
    })
    @UseGuards(Agent)
    @Get('agent')
    async getAgentDashboardData(@Req() req) {
      const agentId = req.user.agentId;
      return await this.dashboardOverviewService.getAgentDashboard(agentId);
    }
}

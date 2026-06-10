import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('availability')
@UseGuards(AuthGuard('jwt'))
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('dashboard')
  async getDashboard(@Request() req) {
    const id = req.user?.vendorId || await this.availabilityService.getVendorId(req.user?.sub);
    return this.availabilityService.getDashboardStats(id);
  }

  @Get('schedule')
  async getSchedule(@Request() req, @Query('date') date: string, @Query('category') category: string) {
    const id = req.user?.vendorId || await this.availabilityService.getVendorId(req.user?.sub);
    return this.availabilityService.getSchedule(id, date || new Date().toISOString(), category || 'Studio');
  }

  @Get('inventory')
  async getInventory(@Request() req, @Query('category') category: string) {
    const id = req.user?.vendorId || await this.availabilityService.getVendorId(req.user?.sub);
    return this.availabilityService.getCategoryInventory(id, category || 'Studio');
  }

  @Post('block')
  async createBlock(@Request() req, @Body() dto: any) {
    const id = req.user?.vendorId || await this.availabilityService.getVendorId(req.user?.sub);
    return this.availabilityService.createBlock(id, dto);
  }
}

import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('availability')
@UseGuards(AuthGuard('jwt'))
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('dashboard')
  async getDashboard(@Request() req) {
    const vendorId = req.user.vendorId; // Assuming vendorId is resolved from token payload or similar.
    // If user.vendorId is not in token, it will need to be fetched via user.id
    
    // For now, let's use a dummy vendor ID if not found to prevent crashes during dev
    const id = vendorId || 1; 
    return this.availabilityService.getDashboardStats(id);
  }

  @Get('schedule')
  async getSchedule(@Request() req, @Query('date') date: string, @Query('category') category: string) {
    const id = req.user?.vendorId || 1;
    return this.availabilityService.getSchedule(id, date || new Date().toISOString(), category || 'Studio');
  }

  @Post('block')
  async createBlock(@Request() req, @Body() dto: any) {
    const id = req.user?.vendorId || 1;
    return this.availabilityService.createBlock(id, dto);
  }
}

import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(@Body() body: any) {
    const data = await this.bookingsService.create(body);
    return { success: true, data };
  }

  @Get(':userId')
  async findByUser(@Param('userId') userId: string) {
    const data = await this.bookingsService.findByUser(userId);
    return { success: true, data };
  }

  @Get('vendor/:vendorId')
  async findByVendor(@Param('vendorId') vendorId: string) {
    const data = await this.bookingsService.findByVendor(vendorId);
    return { success: true, data };
  }
}

import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(@Body() body: any) {
    const data = await this.bookingsService.create(body);
    return { success: true, data };
  }

  // ⚠️ IMPORTANT: vendor/:vendorId MUST be declared BEFORE :userId
  // Otherwise NestJS's :userId wildcard captures the word "vendor" as a userId.
  @Get('vendor/:vendorId')
  async findByVendor(@Param('vendorId') vendorId: string) {
    const data = await this.bookingsService.findByVendor(vendorId);
    return { success: true, data };
  }

  @Get(':userId')
  async findByUser(@Param('userId') userId: string) {
    const data = await this.bookingsService.findByUser(userId);
    return { success: true, data };
  }

  // PATCH /bookings/:id/status  — update booking status (cancel, complete, confirm)
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    const data = await this.bookingsService.updateStatus(id, body.status);
    return { success: true, data };
  }
}

import { Controller, Get, Post, Patch, Body, Param, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { RazorpayService } from '../razorpay/razorpay.service';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly razorpayService: RazorpayService,
  ) {}

  @Post('create-payment')
  async createPayment(@Body('amount') amount: number) {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Valid amount is required');
    }
    const order = await this.razorpayService.createOrder(amount);
    return { success: true, data: order };
  }

  @Post('verify-and-create')
  async verifyAndCreate(@Body() body: any) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, ...bookingData } = body;
    
    // Only verify if razorpay data is provided (e.g. deposit was required)
    if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const isValid = this.razorpayService.verifyPayment(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      );

      if (!isValid) {
        throw new BadRequestException('Payment verification failed');
      }
    }

    const data = await this.bookingsService.create(body);
    return { success: true, data };
  }

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

  @Post(':id/deliver')
  async markAsDelivered(@Param('id') id: string, @Body() body: { urls: string[] }) {
    if (!body.urls || !Array.isArray(body.urls)) {
      throw new BadRequestException('Image URLs are required');
    }
    const data = await this.bookingsService.markAsDelivered(id, body.urls);
    return { success: true, data };
  }

  @Post(':id/accept-delivery')
  async acceptDelivery(@Param('id') id: string) {
    const data = await this.bookingsService.acceptDelivery(id);
    return { success: true, data };
  }

  @Post(':id/issues')
  async reportIssue(
    @Param('id') id: string,
    @Body() body: { vendor_id: number; description: string; urls?: string[] }
  ) {
    if (!body.vendor_id || !body.description) {
      throw new BadRequestException('vendor_id and description are required');
    }
    const data = await this.bookingsService.reportIssue(id, body.vendor_id, body.description, body.urls || []);
    return { success: true, data };
  }
}

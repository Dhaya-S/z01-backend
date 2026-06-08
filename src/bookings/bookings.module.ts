import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { DatabaseModule } from '../database/database.module';
import { RazorpayModule } from '../razorpay/razorpay.module';

@Module({
  imports: [DatabaseModule, RazorpayModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}

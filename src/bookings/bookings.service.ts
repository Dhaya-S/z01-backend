import { Injectable, Inject, InternalServerErrorException } from '@nestjs/common';
import { Pool } from 'pg';
import { OneSignalService } from '../onesignal/onesignal.service';
import { RazorpayService } from '../razorpay/razorpay.service';

@Injectable()
export class BookingsService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private readonly onesignalService: OneSignalService,
    private readonly razorpayService: RazorpayService,
  ) {}

  async create(body: any) {
    try {
      const {
        user_id,
        listing_id,
        start_date,
        end_date,
        total_amount,
        status,
        deposit_amount,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = body;

      // deposit_amount from request body (sent by user app at booking time)
      const deposit = parseFloat(deposit_amount ?? 0) || 0;

      const { rows } = await this.pool.query(
        `INSERT INTO bookings
           (user_id, listing_id, start_date, end_date, total_amount, status, deposit_amount, deposit_status, razorpay_order_id, razorpay_payment_id, razorpay_signature)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          user_id,
          listing_id,
          start_date,
          end_date,
          total_amount,
          status || 'pending',
          deposit,
          deposit > 0 ? 'held' : null,
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
        ]
      );
      const booking = rows[0];

      // Fetch vendor info to send notification
      const listingRes = await this.pool.query(
        'SELECT vendor_id, listing_title FROM vendor_listings WHERE id = $1',
        [listing_id]
      );
      if (listingRes.rows.length > 0) {
        const { vendor_id, listing_title } = listingRes.rows[0];
        const depositNote =
          deposit > 0 ? ` A security deposit of ₹${deposit.toFixed(0)} has been collected.` : '';
        await this.pool.query(
          'INSERT INTO vendor_notifications (vendor_id, type, title, body) VALUES ($1, $2, $3, $4)',
          [
            vendor_id,
            'booking',
            'New Booking Received',
            `Someone just booked your ${listing_title || 'item'}.${depositNote}`,
          ]
        );
        await this.onesignalService.sendVendorNotification(
          vendor_id,
          'New Booking Received',
          `Someone just booked your ${listing_title || 'item'}.${depositNote}`,
          { type: 'booking', bookingId: booking.id }
        );
      }

      return booking;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Failed to create booking');
    }
  }

  async findByUser(userId: string) {
    try {
      const { rows } = await this.pool.query(
        `SELECT b.*,
                v.listing_title as item_name,
                v.category as listing_category,
                v.image_1,
                b.total_amount as total_price,
                b.deposit_amount,
                b.deposit_status,
                TO_CHAR(b.start_date, 'YYYY-MM-DD') as date,
                TO_CHAR(b.start_date, 'HH24:MI') as start_time,
                TO_CHAR(b.end_date, 'HH24:MI') as end_time
         FROM bookings b
         LEFT JOIN vendor_listings v ON b.listing_id = v.id
         WHERE b.user_id = $1
         ORDER BY b.created_at DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch bookings');
    }
  }

  async findByVendor(vendorId: string) {
    try {
      const { rows } = await this.pool.query(
        `SELECT b.*,
                v.listing_title as item_name,
                v.category as listing_category,
                v.image_1,
                v.vendor_id,
                b.total_amount as total_price,
                b.deposit_amount,
                b.deposit_status,
                TO_CHAR(b.start_date, 'YYYY-MM-DD') as date,
                TO_CHAR(b.start_date, 'HH24:MI') as start_time,
                TO_CHAR(b.end_date, 'HH24:MI') as end_time,
                json_build_object('name', u.name, 'email', u.email, 'phone', u.phone) as users
         FROM bookings b
         JOIN vendor_listings v ON b.listing_id = v.id
         LEFT JOIN users u ON b.user_id = u.id
         WHERE v.vendor_id = $1
         ORDER BY b.created_at DESC`,
        [vendorId]
      );
      return rows;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch vendor bookings');
    }
  }

  async updateStatus(bookingId: string, status: string) {
    try {
      // ── 1. Fetch the current booking ──────────────────────────────────────
      const bookingRes = await this.pool.query(
        'SELECT * FROM bookings WHERE id = $1',
        [bookingId]
      );
      if (bookingRes.rows.length === 0)
        throw new InternalServerErrorException('Booking not found');

      const booking = bookingRes.rows[0];
      const depositAmount = parseFloat(booking.deposit_amount ?? 0) || 0;
      const hasDeposit = depositAmount > 0;

      // ── 2. Build deposit_status based on action ────────────────────────────
      const isConfirmed =
        status.toLowerCase() === 'confirmed';
      const isCancelled =
        status.toLowerCase() === 'cancelled' ||
        status.toLowerCase() === 'canceled';

      let newDepositStatus = booking.deposit_status;
      if (hasDeposit) {
        if (isConfirmed) newDepositStatus = 'released_to_vendor';
        if (isCancelled) newDepositStatus = 'refunded_to_user';
      }

      // ── 3. Update booking row ──────────────────────────────────────────────
      const { rows } = await this.pool.query(
        `UPDATE bookings
         SET status = $1, deposit_status = $2
         WHERE id = $3
         RETURNING *`,
        [status, newDepositStatus, bookingId]
      );
      const updatedBooking = rows[0];

      // ── 4. Fetch listing + vendor ──────────────────────────────────────────
      const listingRes = await this.pool.query(
        'SELECT vendor_id, listing_title FROM vendor_listings WHERE id = $1',
        [booking.listing_id]
      );

      if (listingRes.rows.length > 0) {
        const { vendor_id, listing_title } = listingRes.rows[0];
        const itemName = listing_title || 'an item';
        const depositStr =
          hasDeposit ? ` ₹${depositAmount.toFixed(0)} security deposit` : '';

        // ── 5a. CONFIRM → credit vendor_earnings + notify user ───────────────
        if (isConfirmed) {
          // Record deposit in vendor_earnings
          if (hasDeposit) {
            await this.pool.query(
              `INSERT INTO vendor_earnings (vendor_id, booking_id, amount, type, status)
               VALUES ($1, $2, $3, 'deposit', 'pending')`,
              [vendor_id, bookingId, depositAmount]
            );
          }

          // Notify user: booking confirmed
          const userMsg = hasDeposit
            ? `Your booking for ${itemName} has been confirmed by the vendor. The${depositStr} will be held until booking completion.`
            : `Your booking for ${itemName} has been confirmed by the vendor.`;
          await this.pool.query(
            'INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)',
            [booking.user_id, 'Booking Confirmed', userMsg]
          );

          // Notify vendor: deposit credited
          if (hasDeposit) {
            await this.pool.query(
              'INSERT INTO vendor_notifications (vendor_id, type, title, body) VALUES ($1, $2, $3, $4)',
              [
                vendor_id,
                'earnings',
                'Deposit Added to Earnings',
                `The${depositStr} from the ${itemName} booking has been added to your earnings.`,
              ]
            );
            await this.onesignalService.sendVendorNotification(
              vendor_id,
              'Deposit Added to Earnings',
              `The${depositStr} from the ${itemName} booking has been added to your earnings.`,
              { type: 'earnings', bookingId: booking.id }
            );
          }
        }

        // ── 5b. CANCEL → refund deposit + notify both parties ─────────────────
        if (isCancelled) {
          // Notify user: deposit refunded
          const userRefundMsg = hasDeposit
            ? `Your booking for ${itemName} has been cancelled. The${depositStr} will be refunded to your bank account within 3–5 business days.`
            : `Your booking for ${itemName} has been cancelled.`;
          await this.pool.query(
            'INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)',
            [booking.user_id, 'Booking Cancelled — Deposit Refunded', userRefundMsg]
          );

          // Notify vendor: booking cancelled
          const vendorCancelMsg = hasDeposit
            ? `The booking for ${itemName} has been cancelled. The${depositStr} will be refunded to the user.`
            : `The booking for ${itemName} has been cancelled.`;
          await this.pool.query(
            'INSERT INTO vendor_notifications (vendor_id, type, title, body) VALUES ($1, $2, $3, $4)',
            [vendor_id, 'system', 'Booking Cancelled', vendorCancelMsg]
          );
          await this.onesignalService.sendVendorNotification(
            vendor_id,
            'Booking Cancelled',
            vendorCancelMsg,
            { type: 'system', bookingId: booking.id }
          );

          // Process Razorpay Refund
          if (hasDeposit && booking.razorpay_payment_id) {
            try {
              await this.razorpayService.refundPayment(booking.razorpay_payment_id, depositAmount);
            } catch (refundError) {
              console.error('Failed to issue Razorpay refund for booking', booking.id, refundError);
            }
          }
        }
      }

      return updatedBooking;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Failed to update booking status');
    }
  }
}

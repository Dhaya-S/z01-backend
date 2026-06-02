import { Injectable, Inject, InternalServerErrorException } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class BookingsService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async create(body: any) {
    try {
      const { user_id, listing_id, start_date, end_date, total_amount, status } = body;
      
      const { rows } = await this.pool.query(
        'INSERT INTO bookings (user_id, listing_id, start_date, end_date, total_amount, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [user_id, listing_id, start_date, end_date, total_amount, status || 'pending']
      );
      const booking = rows[0];

      // Fetch vendor info to send notification
      const listingRes = await this.pool.query('SELECT vendor_id, listing_title FROM vendor_listings WHERE id = $1', [listing_id]);
      if (listingRes.rows.length > 0) {
        const { vendor_id, listing_title } = listingRes.rows[0];
        await this.pool.query(
          'INSERT INTO vendor_notifications (vendor_id, type, title, body) VALUES ($1, $2, $3, $4)',
          [vendor_id, 'booking', 'New Booking Received', `Someone just booked your ${listing_title || 'item'}.`]
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
      const { rows } = await this.pool.query(
        `UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *`,
        [status, bookingId]
      );
      if (rows.length === 0) throw new InternalServerErrorException('Booking not found');
      
      const booking = rows[0];

      if (status.toLowerCase() === 'confirmed' || status.toLowerCase() === 'canceled' || status.toLowerCase() === 'cancelled') {
        const listingRes = await this.pool.query('SELECT vendor_id, listing_title FROM vendor_listings WHERE id = $1', [booking.listing_id]);
        if (listingRes.rows.length > 0) {
          const itemName = listingRes.rows[0].listing_title || 'an item';
          const vendorId = listingRes.rows[0].vendor_id;
          
          if (status.toLowerCase() === 'confirmed') {
            // Notify User
            await this.pool.query(
              'INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)',
              [booking.user_id, 'Booking Confirmed', `Your booking for ${itemName} has been confirmed by the vendor.`]
            );
          } else {
            // Notify Vendor
            await this.pool.query(
              'INSERT INTO vendor_notifications (vendor_id, type, title, body) VALUES ($1, $2, $3, $4)',
              [vendorId, 'system', 'Booking Cancelled', `The booking for ${itemName} has been cancelled.`]
            );
          }
        }
      }

      return booking;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Failed to update booking status');
    }
  }
}

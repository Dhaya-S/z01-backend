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
      return rows[0];
    } catch (error) {
      throw new InternalServerErrorException('Failed to create booking');
    }
  }

  async findByUser(userId: string) {
    try {
      const { rows } = await this.pool.query(
        `SELECT b.*,
                v.listing_title as item_name,
                v.category as listing_category,
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
}

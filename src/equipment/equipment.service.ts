import { Injectable, Inject, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class EquipmentService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async findAll(vendorId?: number, date?: string) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      let query = `
        SELECT vl.*, 
        (SELECT COALESCE(json_agg(DISTINCT TO_CHAR(vab.start_date, 'YYYY-MM-DD')), '[]') 
         FROM vendor_availability_blocks vab 
         WHERE vab.vendor_id = vl.vendor_id AND vab.category = vl.category AND (vab.listing_id IS NULL OR vab.listing_id = vl.id)) as blocked_dates,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM vendor_availability_blocks vab
            WHERE vab.vendor_id = vl.vendor_id 
              AND vab.category = vl.category 
              AND (vab.listing_id IS NULL OR vab.listing_id = vl.id)
              AND $2::DATE BETWEEN vab.start_date::DATE AND vab.end_date::DATE
          ) THEN 'paused'
          ELSE vl.status
        END as status
        FROM vendor_listings vl 
        WHERE vl.category = $1
      `;
      const params: any[] = ['Equipment', targetDate];

      if (vendorId) {
        query += ' AND vendor_id = $3';
        params.push(vendorId);
      }

      query += ' ORDER BY created_at DESC';
      const { rows } = await this.pool.query(query, params);
      return rows;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch equipment');
    }
  }

  async findOne(id: number, date?: string) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const { rows } = await this.pool.query(`
        SELECT vl.*, 
        (SELECT COALESCE(json_agg(DISTINCT TO_CHAR(vab.start_date, 'YYYY-MM-DD')), '[]') 
         FROM vendor_availability_blocks vab 
         WHERE vab.vendor_id = vl.vendor_id AND vab.category = vl.category AND (vab.listing_id IS NULL OR vab.listing_id = vl.id)) as blocked_dates,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM vendor_availability_blocks vab
            WHERE vab.vendor_id = vl.vendor_id 
              AND vab.category = vl.category 
              AND (vab.listing_id IS NULL OR vab.listing_id = vl.id)
              AND $3::DATE BETWEEN vab.start_date::DATE AND vab.end_date::DATE
          ) THEN 'paused'
          ELSE vl.status
        END as status
        FROM vendor_listings vl 
        WHERE vl.id = $1 AND vl.category = $2
      `, [id, 'Equipment', targetDate]);
      if (rows.length === 0) {
        throw new NotFoundException('Equipment not found');
      }
      return rows[0];
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to fetch equipment');
    }
  }

  async create(vendorId: number, data: any) {
    try {
      const columns = [
        'vendor_id', 'category', 'sub_category', 'listing_title', 'short_description',
        'amenities', 'brand', 'model', 'specifications',
        'quantity', 'deposit_amount', 'price_per_hour', 'price_per_day',
        'minimum_booking_hours', 'cancellation_policy',
        'location_address', 'street_address', 'delivery_available', 'id_verification_required',
        'min_age', 'insurance_required', 'rules', 'terms_pdf_url',
        'image_1', 'image_2', 'image_3', 'image_4', 'image_5', 'status',
        'location_lat', 'location_lng'
      ];

      const values = [
        vendorId, 'Equipment', data.sub_category, data.listing_title, data.short_description,
        JSON.stringify(data.amenities || []),
        data.brand || null, data.model || null, data.specifications || null,
        data.quantity || 1, data.deposit_amount || 0, data.price_per_hour || 0, data.price_per_day || 0,
        data.minimum_booking_hours || 1, data.cancellation_policy || 'flexible',
        data.location_address, data.street_address, data.delivery_available || false,
        data.id_verification_required || false, data.min_age || 18,
        data.insurance_required || false, data.rules, data.terms_pdf_url,
        data.image_1, data.image_2, data.image_3, data.image_4, data.image_5,
        data.status || 'active',
        data.location_lat || null, data.location_lng || null
      ];

      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const query = `INSERT INTO vendor_listings (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;

      const { rows } = await this.pool.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Create equipment error:', error);
      throw new InternalServerErrorException('Failed to create equipment');
    }
  }

  async update(id: number, vendorId: number, data: any) {
    try {
      const columns = [
        'sub_category', 'listing_title', 'short_description',
        'amenities', 'brand', 'model', 'specifications',
        'quantity', 'deposit_amount', 'price_per_hour', 'price_per_day',
        'minimum_booking_hours', 'cancellation_policy',
        'location_address', 'street_address', 'delivery_available', 'id_verification_required',
        'min_age', 'insurance_required', 'rules', 'terms_pdf_url',
        'image_1', 'image_2', 'image_3', 'image_4', 'image_5', 'status',
        'location_lat', 'location_lng'
      ];

      const values = [
        data.sub_category, data.listing_title, data.short_description,
        JSON.stringify(data.amenities || []),
        data.brand || null, data.model || null, data.specifications || null,
        data.quantity || 1, data.deposit_amount || 0, data.price_per_hour || 0, data.price_per_day || 0,
        data.minimum_booking_hours || 1, data.cancellation_policy || 'flexible',
        data.location_address, data.street_address, data.delivery_available || false,
        data.id_verification_required || false, data.min_age || 18,
        data.insurance_required || false, data.rules, data.terms_pdf_url,
        data.image_1, data.image_2, data.image_3, data.image_4, data.image_5,
        data.status || 'active',
        data.location_lat || null, data.location_lng || null
      ].map(v => v === undefined ? null : v);

      const sets = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
      const query = `UPDATE vendor_listings SET ${sets} WHERE id = $${columns.length + 1} AND vendor_id = $${columns.length + 2} AND category = 'Equipment' RETURNING *`;

      const { rows } = await this.pool.query(query, [...values, id, vendorId]);
      if (rows.length === 0) {
        throw new NotFoundException('Equipment not found or unauthorized');
      }
      return rows[0];
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Update equipment error:', error);
      throw new InternalServerErrorException(`Failed to update listing: ${error.message}`);
    }
  }

  async delete(id: number, vendorId: number) {
    try {
      const { rowCount } = await this.pool.query('DELETE FROM vendor_listings WHERE id = $1 AND vendor_id = $2 AND category = $3', [id, vendorId, 'Equipment']);
      if (rowCount === 0) {
        throw new NotFoundException('Equipment not found or unauthorized');
      }
      return { message: 'Equipment deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to delete equipment');
    }
  }
}

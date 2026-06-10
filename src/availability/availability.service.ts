import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class AvailabilityService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async getDashboardStats(vendorId: number) {
    const todayStr = new Date().toISOString().split('T')[0];

    // Get total listings per category
    const listingsRes = await this.pool.query(`
      SELECT category, COUNT(*) as count 
      FROM vendor_listings 
      WHERE vendor_id = $1 AND status = 'Active'
      GROUP BY category
    `, [vendorId]);
    
    const totals = { Studio: 0, Equipment: 0, Manpower: 0 };
    listingsRes.rows.forEach((r: any) => { totals[r.category] = parseInt(r.count, 10); });

    // Get today's bookings
    const bookingsTodayRes = await this.pool.query(`
      SELECT vl.category, COUNT(*) as count
      FROM bookings b
      JOIN vendor_listings vl ON b.listing_id = vl.id
      WHERE vl.vendor_id = $1 
      AND b.start_date::DATE <= $2::DATE AND b.end_date::DATE >= $2::DATE
      AND b.status IN ('pending', 'confirmed')
      GROUP BY vl.category
    `, [vendorId, todayStr]);

    const bookedToday = { Studio: 0, Equipment: 0, Manpower: 0 };
    bookingsTodayRes.rows.forEach((r: any) => { bookedToday[r.category] = parseInt(r.count, 10); });

    // Get upcoming bookings
    const upcomingRes = await this.pool.query(`
      SELECT vl.category, COUNT(*) as count
      FROM bookings b
      JOIN vendor_listings vl ON b.listing_id = vl.id
      WHERE vl.vendor_id = $1 AND b.start_date::DATE > $2::DATE
      AND b.status IN ('pending', 'confirmed')
      GROUP BY vl.category
    `, [vendorId, todayStr]);

    const upcoming = { Studio: 0, Equipment: 0, Manpower: 0 };
    upcomingRes.rows.forEach((r: any) => { upcoming[r.category] = parseInt(r.count, 10); });

    // Get blocks today
    const blocksTodayRes = await this.pool.query(`
      SELECT category, reason, COUNT(*) as count
      FROM vendor_availability_blocks
      WHERE vendor_id = $1
      AND start_date::DATE <= $2::DATE AND end_date::DATE >= $2::DATE
      GROUP BY category, reason
    `, [vendorId, todayStr]);

    let equipmentMaintenance = 0;
    const blocksToday = { Studio: 0, Equipment: 0, Manpower: 0 };
    blocksTodayRes.rows.forEach((r: any) => {
      blocksToday[r.category] += parseInt(r.count, 10);
      if (r.category === 'Equipment' && r.reason === 'Maintenance') {
        equipmentMaintenance += parseInt(r.count, 10);
      }
    });

    // Fetch today's schedule for the dashboard overview
    const todayEventsRes = await this.pool.query(`
      SELECT b.start_date, b.end_date, vl.listing_title as title, vl.category, 'User' as subtitle
      FROM bookings b
      JOIN vendor_listings vl ON b.listing_id = vl.id
      WHERE vl.vendor_id = $1
      AND b.start_date::DATE <= $2::DATE AND b.end_date::DATE >= $2::DATE
      AND b.status != 'cancelled'
      ORDER BY b.start_date ASC
      LIMIT 5
    `, [vendorId, todayStr]);

    const formatTime = (d: any) => {
      const dt = new Date(d);
      let hours = dt.getHours();
      const minutes = dt.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; 
      const minStr = minutes < 10 ? '0'+minutes : minutes;
      return `${hours}:${minStr} ${ampm}`;
    };

    const todayEvents = todayEventsRes.rows.map((b: any) => ({
      title: b.title,
      subtitle: b.subtitle,
      category: b.category,
      time: `${formatTime(b.start_date)} - ${formatTime(b.end_date)}`
    }));

    return {
      studio: { 
        bookedToday: bookedToday['Studio'], 
        available: Math.max(0, totals['Studio'] - bookedToday['Studio'] - blocksToday['Studio']), 
        upcoming: upcoming['Studio'] 
      },
      equipment: { 
        available: Math.max(0, totals['Equipment'] - bookedToday['Equipment'] - blocksToday['Equipment']), 
        activeRentals: bookedToday['Equipment'], 
        maintenance: equipmentMaintenance 
      },
      manpower: { 
        bookedHours: bookedToday['Manpower'] * 8, // Assuming 8 hr shifts for simplicity if no detailed time
        remainingHours: Math.max(0, totals['Manpower'] * 8 - (bookedToday['Manpower'] * 8)), 
        upcoming: upcoming['Manpower'] 
      },
      todayEvents: todayEvents
    };
  }

  async getSchedule(vendorId: number, date: string, category: string) {
    const targetDate = new Date(date).toISOString().split('T')[0];

    // Fetch bookings for this day
    const bookingsRes = await this.pool.query(`
      SELECT b.start_date, b.end_date, b.status, vl.listing_title as listing_name, 'User' as user_name
      FROM bookings b
      JOIN vendor_listings vl ON b.listing_id = vl.id
      WHERE vl.vendor_id = $1 AND vl.category = $2
      AND b.start_date::DATE <= $3::DATE AND b.end_date::DATE >= $3::DATE
      AND b.status != 'cancelled'
    `, [vendorId, category, targetDate]);

    // Fetch blocks for this day
    const blocksRes = await this.pool.query(`
      SELECT start_date, end_date, reason
      FROM vendor_availability_blocks 
      WHERE vendor_id = $1 AND category = $2 
      AND start_date::DATE <= $3::DATE AND end_date::DATE >= $3::DATE
    `, [vendorId, category, targetDate]);

    // Format results to feed into the UI's timeline
    const events: any[] = [];
    
    // Add bookings
    for (const b of bookingsRes.rows) {
      events.push({
        startTime: b.start_date,
        endTime: b.end_date,
        type: 'Booked',
        title: b.listing_name || 'Booked',
        subtitle: b.user_name || 'Customer'
      });
    }

    // Add blocks
    for (const b of blocksRes.rows) {
      events.push({
        startTime: b.start_date,
        endTime: b.end_date,
        type: 'Unavailable',
        title: b.reason || 'Blocked',
        subtitle: 'Vendor Block'
      });
    }

    // Sort by start time
    events.sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    // Formatting for the UI, calculating available gaps
    const formattedEvents: any[] = [];
    
    const formatTime = (d: any) => {
      const dt = new Date(d);
      let hours = dt.getHours();
      const minutes = dt.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; 
      const minStr = minutes < 10 ? '0'+minutes : minutes;
      return `${hours}:${minStr} ${ampm}`;
    };

    let currentTime = new Date(`${targetDate}T09:00:00Z`).getTime(); // Start day at 9 AM for mockup
    const endOfDay = new Date(`${targetDate}T21:00:00Z`).getTime(); // End at 9 PM

    for (const ev of events) {
      const evStart = new Date(ev.startTime).getTime();
      const evEnd = new Date(ev.endTime).getTime();

      if (evStart > currentTime && evStart < endOfDay) {
        formattedEvents.push({
          startTime: formatTime(currentTime),
          endTime: formatTime(evStart),
          type: 'Available',
          title: 'Available'
        });
      }

      if (evEnd > currentTime) {
        formattedEvents.push({
          startTime: formatTime(Math.max(evStart, currentTime)),
          endTime: formatTime(Math.min(evEnd, endOfDay)),
          type: ev.type,
          title: ev.title,
          subtitle: ev.subtitle
        });
        currentTime = evEnd;
      }
    }

    if (currentTime < endOfDay) {
      formattedEvents.push({
        startTime: formatTime(currentTime),
        endTime: formatTime(endOfDay),
        type: 'Available',
        title: 'Available'
      });
    }

    // Default to fully available if no events
    if (formattedEvents.length === 0) {
      formattedEvents.push({
        startTime: '9:00 AM',
        endTime: '9:00 PM',
        type: 'Available',
        title: 'Available'
      });
    }

    return { events: formattedEvents, blocks: blocksRes.rows };
  }

  async createBlock(vendorId: number, dto: any) {
    const { category, dates, reason } = dto;
    for (const date of dates) {
      const startDate = `${date} 00:00:00`;
      const endDate = `${date} 23:59:59`;
      await this.pool.query(`
        INSERT INTO vendor_availability_blocks (vendor_id, category, start_date, end_date, reason)
        VALUES ($1, $2, $3, $4, $5)
      `, [vendorId, category, startDate, endDate, reason]);
    }
    return { success: true, message: 'Blocks created successfully' };
  }
}

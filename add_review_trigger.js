t6const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function addTrigger() {
  const client = await pool.connect();
  try {
    // 1. Create the function
    await client.query(`
      CREATE OR REPLACE FUNCTION notify_vendor_on_review()
      RETURNS TRIGGER AS $$
      DECLARE
          v_id INTEGER;
          v_title VARCHAR;
      BEGIN
          -- Get vendor_id and listing_title from vendor_listings
          SELECT vendor_id, listing_title INTO v_id, v_title
          FROM vendor_listings
          WHERE id = NEW.listing_id;
          
          IF v_id IS NOT NULL THEN
              INSERT INTO vendor_notifications (vendor_id, type, title, body, created_at, is_read)
              VALUES (v_id, 'review', 'New Review Received', 'A customer left a ' || NEW.rating || '-star review for your ' || COALESCE(v_title, 'listing') || '.', NOW(), false);
          END IF;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('Function created.');

    // 2. Drop the trigger if it exists
    await client.query(`DROP TRIGGER IF EXISTS after_review_insert ON reviews;`);

    // 3. Create the trigger
    await client.query(`
      CREATE TRIGGER after_review_insert
      AFTER INSERT ON reviews
      FOR EACH ROW
      EXECUTE FUNCTION notify_vendor_on_review();
    `);
    console.log('Trigger created.');

    // 4. (Optional) Backfill existing reviews as notifications so they show up now?
    // Actually, creating notifications for old reviews might be good for the user to see!
    // But they might be duplicated if we run this twice.
    // Let's just create the trigger for new ones. 
    // Wait, the user specifically wants to see the 6 reviews in the screenshot!
    // Let's backfill notifications for existing reviews that don't have a notification yet.
    
    const { rows: reviews } = await client.query('SELECT r.*, vl.vendor_id, vl.listing_title FROM reviews r JOIN vendor_listings vl ON vl.id = r.listing_id');
    
    let addedCount = 0;
    for (const r of reviews) {
      if (!r.vendor_id) continue;
      
      // Check if a review notification already exists for this vendor with a body containing this rating/listing
      // We'll just check if there's any review notification near the review created_at time
      const { rows: existingNotifs } = await client.query(
        "SELECT id FROM vendor_notifications WHERE vendor_id = $1 AND type = 'review' AND title = 'New Review Received' AND created_at >= $2::timestamp - interval '1 minute' AND created_at <= $2::timestamp + interval '1 minute'",
        [r.vendor_id, r.created_at || new Date()]
      );

      if (existingNotifs.length === 0) {
        await client.query(
          "INSERT INTO vendor_notifications (vendor_id, type, title, body, created_at, is_read) VALUES ($1, 'review', 'New Review Received', $2, $3, false)",
          [r.vendor_id, `A customer left a ${r.rating}-star review for your ${r.listing_title || 'listing'}.`, r.created_at || new Date()]
        );
        addedCount++;
      }
    }
    console.log(`Backfilled ${addedCount} review notifications.`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

addTrigger();

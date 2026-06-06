const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID || "8ba49c7c-97fb-4410-8354-ccb8dd2abfb5";
const REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || "os_v2_app_rosjy7ex7ncbba2uzs4n2kv7wxk6jdpga3ne3x5rdinwqxja6j5vcanrhuujjuxsn2tk3vh4i7ng6ajyzzzrjuzivvfwvtx3pm2wydi";

// Replace this with the actual vendor ID you see in your PostgreSQL database after logging in
const vendorId = "REPLACE_WITH_YOUR_VENDOR_ID"; 

async function sendTestPush() {
  if (vendorId === "REPLACE_WITH_YOUR_VENDOR_ID") {
    console.log("Please update the vendorId in the script with an actual vendor ID from your database.");
    return;
  }

  try {
    const payload = {
      app_id: APP_ID,
      target_channel: 'push',
      include_aliases: {
        external_id: [`vendor_${vendorId}`],
      },
      headings: { en: "Test Notification" },
      contents: { en: "This is a test notification for the Vendor App!" },
      data: { type: 'test' }
    };

    const response = await axios.post('https://onesignal.com/api/v1/notifications', payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${REST_API_KEY}`,
      },
    });

    console.log("Success! Notification sent.", response.data);
  } catch (error) {
    console.error("Failed to send notification:", error.response ? error.response.data : error.message);
  }
}

sendTestPush();

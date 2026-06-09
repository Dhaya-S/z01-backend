import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OneSignalService {
  private readonly logger = new Logger(OneSignalService.name);
  private readonly appId: string;
  private readonly restApiKey: string;
  private readonly baseUrl = 'https://onesignal.com/api/v1/notifications';

  constructor() {
    this.appId = process.env.ONESIGNAL_APP_ID || '8ba49c7c-97fb-4410-8354-ccb8dd2abfb5';
    this.restApiKey =
      process.env.ONESIGNAL_REST_API_KEY ||
      'os_v2_app_rosjy7ex7ncbba2uzs4n2kv7wxk6jdpga3ne3x5rdinwqxja6j5vcanrhuujjuxsn2tk3vh4i7ng6ajyzzzrjuzivvfwvtx3pm2wydi';
  }

  async sendVendorNotification(vendorId: string, title: string, body: string, data?: any) {
    try {
      const payload = {
        app_id: this.appId,
        target_channel: 'push',
        include_aliases: {
          external_id: [`vendor_${vendorId}`],
        },
        headings: { en: title },
        contents: { en: body },
        data: data || {},
        priority: 10, // Forces high priority for pop-up and vibration
        ios_sound: 'default',
        android_sound: 'default',
        android_visibility: 1, // 1 = Public (shows on lock screen)
      };

      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.restApiKey.startsWith('os_v2_app_')
            ? `Key ${this.restApiKey}`
            : `Basic ${this.restApiKey}`,
        },
      });

      this.logger.log(`OneSignal notification sent to vendor_${vendorId}: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to send OneSignal notification to vendor_${vendorId}`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async sendUserNotification(userId: string, title: string, body: string, data?: any) {
    try {
      const payload = {
        app_id: this.appId,
        target_channel: 'push',
        include_aliases: {
          // Supporting both typical patterns for user external IDs
          external_id: [`user_${userId}`, `${userId}`],
        },
        headings: { en: title },
        contents: { en: body },
        data: data || {},
        priority: 10,
        ios_sound: 'default',
        android_sound: 'default',
        android_visibility: 1,
      };

      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.restApiKey.startsWith('os_v2_app_')
            ? `Key ${this.restApiKey}`
            : `Basic ${this.restApiKey}`,
        },
      });

      this.logger.log(`OneSignal notification sent to user_${userId}: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to send OneSignal notification to user_${userId}`,
        error.response?.data || error.message,
      );
      // We don't throw here to avoid failing the main transaction if push fails
    }
  }

  // 1. New Booking Notification
  async sendNewBookingNotification(vendorId: string, bookingId: string, customerName: string, serviceName: string) {
    const title = '🎉 New Booking Received!';
    const body = `${customerName} just booked "${serviceName}". Tap to view details.`;
    return this.sendVendorNotification(vendorId, title, body, { type: 'new_booking', bookingId });
  }

  // 2. Cancelled Booking Notification
  async sendBookingCancelledNotification(vendorId: string, bookingId: string, customerName: string, serviceName: string) {
    const title = '⚠️ Booking Cancelled';
    const body = `${customerName} has cancelled their booking for "${serviceName}".`;
    return this.sendVendorNotification(vendorId, title, body, { type: 'booking_cancelled', bookingId });
  }

  // 3. New Review Notification
  async sendNewReviewNotification(vendorId: string, reviewerName: string, rating: number, reviewText: string) {
    const title = `⭐ New ${rating}-Star Review!`;
    const body = `${reviewerName} left a new review: "${reviewText.substring(0, 50)}${reviewText.length > 50 ? '...' : ''}"`;
    return this.sendVendorNotification(vendorId, title, body, { type: 'new_review' });
  }

  // 4. Money Credited Notification
  async sendMoneyCreditedNotification(vendorId: string, amount: string | number, transactionId: string) {
    const title = '💰 Money Credited to Your Account';
    const body = `₹${amount} has been successfully credited to your wallet. Tap to check your balance!`;
    return this.sendVendorNotification(vendorId, title, body, { type: 'money_credited', transactionId });
  }
}

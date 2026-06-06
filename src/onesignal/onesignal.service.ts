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
}

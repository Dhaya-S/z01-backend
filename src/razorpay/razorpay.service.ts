import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
const Razorpay = require('razorpay');

@Injectable()
export class RazorpayService {
  private razorpay: any;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key_id',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret',
    });
  }

  async createOrder(amount: number, receipt: string = 'receipt#1'): Promise<any> {
    try {
      const options = {
        amount: Math.round(amount * 100), // amount in the smallest currency unit (paise)
        currency: 'INR',
        receipt: receipt,
      };
      const order = await this.razorpay.orders.create(options);
      return order;
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw new InternalServerErrorException('Could not create payment order');
    }
  }

  verifyPayment(orderId: string, paymentId: string, signature: string): boolean {
    const text = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret')
      .update(text)
      .digest('hex');

    return expectedSignature === signature;
  }

  async refundPayment(paymentId: string, amount: number): Promise<any> {
    try {
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: Math.round(amount * 100),
      });
      return refund;
    } catch (error) {
      console.error('Error refunding payment:', error);
      throw new InternalServerErrorException('Could not process refund');
    }
  }
}

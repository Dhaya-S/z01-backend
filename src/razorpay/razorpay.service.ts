import { Injectable, InternalServerErrorException, Inject } from '@nestjs/common';
import * as crypto from 'crypto';
import { Pool } from 'pg';
const Razorpay = require('razorpay');

@Injectable()
export class RazorpayService {
  private razorpay: any;

  constructor(@Inject('DATABASE_POOL') private pool: Pool) {
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

  async processVendorPayout(vendorId: number, amount: number): Promise<any> {
    try {
      // 1. Fetch vendor bank details and personal info
      const vendorRes = await this.pool.query('SELECT contact_person, company_name, email, phone FROM vendors WHERE id = $1', [vendorId]);
      const bankRes = await this.pool.query('SELECT account_holder_name, account_number, ifsc_code FROM vendor_bank_details WHERE vendor_id = $1', [vendorId]);
      
      if (vendorRes.rows.length === 0 || bankRes.rows.length === 0) {
        throw new Error('Vendor or Bank Details not found');
      }

      const vendor = vendorRes.rows[0];
      const bank = bankRes.rows[0];

      // 2. Create Contact in Razorpay
      const contact = await this.razorpay.contacts.create({
        name: bank.account_holder_name || vendor.contact_person || vendor.company_name || `Vendor ${vendorId}`,
        email: vendor.email || `vendor_${vendorId}@example.com`,
        contact: vendor.phone || '9999999999',
        type: 'vendor',
        reference_id: `vendor_${vendorId}`,
      });

      // 3. Create Fund Account
      const fundAccount = await this.razorpay.fundAccount.create({
        contact_id: contact.id,
        account_type: 'bank_account',
        bank_account: {
          name: bank.account_holder_name,
          ifsc: bank.ifsc_code,
          account_number: bank.account_number,
        },
      });

      // 4. Initiate Payout
      const payout = await this.razorpay.payouts.create({
        account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER || process.env.RAZORPAY_KEY_ID || 'dummy_account_number',
        fund_account_id: fundAccount.id,
        amount: Math.round(amount * 100), // in paise
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'vendor_payout',
        queueIfLowBalance: true,
        reference_id: `payout_vendor_${vendorId}_${Date.now()}`,
        narration: 'Booking Payout',
      });

      console.log('Vendor payout initiated successfully:', payout.id);
      return payout;
    } catch (error) {
      console.error('Error processing vendor payout:', error);
      // We log but do not throw to avoid crashing the whole acceptDelivery flow if RazorpayX lacks balance or isn't set up yet
      return { status: 'failed', error: error.message };
    }
  }
}

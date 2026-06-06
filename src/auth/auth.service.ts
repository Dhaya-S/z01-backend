import { Injectable, Inject, BadRequestException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { Pool } from 'pg';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { OneSignalService } from '../onesignal/onesignal.service';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private jwtService: JwtService,
    private oneSignalService: OneSignalService
  ) {
    this.googleClient = new OAuth2Client('900673747557-ato1lrqoib1mn8l2sf3cj1tbqus7s4vk.apps.googleusercontent.com');
  }

  // ── Send OTP ──────────────────────────────────────────────────────────────
  async sendOtp(body: any) {
    const { phone, mode } = body;
    if (!phone) throw new BadRequestException('Phone number is required');

    const cleanPhone = phone.replace('+', ''); // Fast2SMS expects numbers without +
    const localNumber = cleanPhone.startsWith('91') ? cleanPhone.substring(2) : cleanPhone;
    const normalizedPhone = phone.startsWith('+') ? phone : `+91${cleanPhone}`;
    const isDevMode = !process.env.FAST2SMS_API_KEY;

    // Check database before sending OTP to save credits
    if (mode === 'login') {
      const { rows } = await this.pool.query(
        `SELECT u.id, v.verification_status 
         FROM users u
         LEFT JOIN vendors v ON u.id = v.user_id
         WHERE u.phone = $1`,
        [normalizedPhone]
      );
      if (rows.length === 0) {
        throw new BadRequestException('Account not found. Please sign up first.');
      }
      if (rows[0].verification_status && rows[0].verification_status !== 'Approved') {
        throw new UnauthorizedException('Your account is pending admin approval. You will be able to log in once approved.');
      }
    } else if (mode === 'signup') {
      const { rows } = await this.pool.query('SELECT id FROM users WHERE phone = $1', [normalizedPhone]);
      if (rows.length > 0) {
        throw new BadRequestException('An account with this phone number already exists.');
      }
    }

    if (isDevMode) {
      console.log(`[DEV MODE] Fast2SMS bypassed. Magic OTP is 123456 for ${phone}`);
      await this.pool.query(
        `INSERT INTO otps (phone, session_id, created_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (phone) DO UPDATE 
         SET session_id = EXCLUDED.session_id, created_at = CURRENT_TIMESTAMP`,
        [phone, 'dev_session_123']
      );
      return {
        success: true,
        status: 'pending',
        phone,
        requestId: 'dev_session_123',
        message: `OTP sent to ${phone} (bypassed)`,
      };
    }

    try {
      const response = await axios.post(
        "https://www.fast2sms.com/dev/otp/send",
        {
          mobile: localNumber,
          otp_id: process.env.FAST2SMS_OTP_ID,
        },
        {
          headers: {
            authorization: process.env.FAST2SMS_API_KEY,
            "Content-Type": "application/json",
            accept: "application/json",
          },
        },
      );

      console.log("FAST2SMS SEND:", response.data);

      if (!response.data.request_id) {
        throw new UnauthorizedException("OTP send failed");
      }

      const requestId = response.data.request_id;

      // Store sessionId in DB
      await this.pool.query(
        `INSERT INTO otps (phone, session_id, created_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (phone) DO UPDATE 
         SET session_id = EXCLUDED.session_id, created_at = CURRENT_TIMESTAMP`,
        [phone, requestId]
      );

      return {
        success: true,
        status: 'pending',
        phone,
        requestId,
        message: `OTP sent successfully to ${phone}`,
      };
    } catch (e: any) {
      console.log(e.response?.data || e.message);
      throw new InternalServerErrorException('Failed to send OTP via SMS provider');
    }
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────
  async verifyOtp(body: any) {
    const { phone, code, mode, name, email } = body; // mode: 'login' | 'signup'
    if (!phone || !code) throw new BadRequestException('Phone and OTP code are required');

    const cleanPhone = phone.replace('+', ''); 
    const localNumber = cleanPhone.startsWith('91') ? cleanPhone.substring(2) : cleanPhone;
    const isDevMode = !process.env.FAST2SMS_API_KEY;

    // Query DB for OTP session
    const { rows } = await this.pool.query(
      'SELECT session_id, created_at FROM otps WHERE phone = $1',
      [phone]
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('No OTP requested or OTP expired');
    }

    const record = rows[0];

    // Check expiration (e.g. 5 minutes = 300000ms)
    const isExpired = (Date.now() - new Date(record.created_at).getTime()) > 300000;
    if (isExpired) {
      await this.pool.query('DELETE FROM otps WHERE phone = $1', [phone]);
      throw new UnauthorizedException('OTP has expired');
    }

    if (isDevMode && code === '123456') {
      // Dev mode bypass
    } else {
      // Call Fast2SMS to verify
      try {
        const response = await axios.post(
          "https://www.fast2sms.com/dev/otp/verify",
          {
            mobile: localNumber,
            otp: code,
            otp_id: process.env.FAST2SMS_OTP_ID,
          },
          {
            headers: {
              authorization: process.env.FAST2SMS_API_KEY,
              "Content-Type": "application/json",
              accept: "application/json",
            },
          },
        );

        console.log("FAST2SMS VERIFY:", response.data);

        if (response.data.return !== true) {
          throw new UnauthorizedException(response.data.message || "Invalid OTP");
        }
      } catch (e: any) {
        console.log(e.response?.data || e.message);
        throw new UnauthorizedException("OTP verification failed or invalid code");
      }
    }

    // Delete OTP session on success
    await this.pool.query('DELETE FROM otps WHERE phone = $1', [phone]);

    // OTP is valid — handle based on mode
    if (mode === 'login') {
      return this._loginWithPhone(phone);
    } else {
      // signup mode — create account and return token
      return this._registerWithPhoneVerified(name, phone, email);
    }
  }

  // ── Login via phone (after OTP verified) ──────────────────────────────────
  private async _loginWithPhone(phone: string) {
    const { rows } = await this.pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.user_type, u.created_at,
              v.id as vendor_id, v.onboarding_status, v.current_step, v.verification_status, v.welcome_sent
       FROM users u
       LEFT JOIN vendors v ON u.id = v.user_id
       WHERE u.phone = $1`,
      [phone]
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('No account found with this phone number. Please sign up first.');
    }

    const user = rows[0];

    if (user.user_type !== 'vendor') {
      throw new UnauthorizedException('Access denied. This portal requires vendor privileges.');
    }

    // If they finished onboarding but admin hasn't approved them yet, block login.
    if (user.onboarding_status === 'Completed' && user.verification_status !== 'Approved') {
      throw new UnauthorizedException('Your account is pending admin approval. You will be able to log in once approved.');
    }

    // Mark phone as verified on login
    await this.pool.query('UPDATE users SET phone_verified = true WHERE id = $1', [user.id]);

    // If this is the first login after approval, send a welcome notification
    if (user.onboarding_status === 'Completed' && user.verification_status === 'Approved' && user.welcome_sent === false) {
      await this.pool.query('UPDATE vendors SET welcome_sent = true WHERE id = $1', [user.vendor_id]);
      this.oneSignalService.sendVendorNotification(
        user.vendor_id,
        'Welcome to CreatorSpace! 🎉',
        'Your account has been fully approved. You can now start receiving bookings!'
      );
    }

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        user_type: user.user_type,
        created_at: user.created_at,
      },
      vendorId: user.vendor_id,
      onboardingStatus: user.onboarding_status,
      currentStep: user.current_step,
      verificationStatus: user.verification_status,
      token,
    };
  }

  // ── Mark phone as verified (signup flow) ──────────────────────────────────
  // ── Register after OTP is verified (signup flow) ─────────────────────────
  private async _registerWithPhoneVerified(name: string, phone: string, email?: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

      // Check if user already exists
      if (email) {
        const existingEmail = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingEmail.rows.length > 0) {
          throw new BadRequestException('An account with this email already exists');
        }
      }

      const existingPhone = await client.query('SELECT id FROM users WHERE phone = $1', [normalizedPhone]);
      if (existingPhone.rows.length > 0) {
        throw new BadRequestException('An account with this phone number already exists');
      }

      // Create user (no password needed for OTP flow)
      const randomPassword = Math.random().toString(36).slice(-8); // Random placeholder password
      const { rows: userRows } = await client.query(
        'INSERT INTO users (name, email, password, phone, user_type, phone_verified) VALUES ($1, $2, $3, $4, $5, true) RETURNING id, name, email, phone, user_type, created_at',
        [name, email || null, randomPassword, normalizedPhone, 'vendor']
      );

      const userId = userRows[0].id;

      // Create vendor record, default verification_status is 'Pending'
      const { rows: vendorRows } = await client.query(
        `INSERT INTO vendors (user_id, company_name, contact_person, phone, email, current_step, onboarding_status, verification_status)
         VALUES ($1, $2, $3, $4, $5, 1, 'Started', 'Pending') RETURNING id, current_step, onboarding_status, verification_status`,
        [userId, name, name, normalizedPhone, email || null]
      );

      await client.query('COMMIT');

      // Generate JWT
      const jwtPayload = { sub: userId, email: email || null };
      const token = this.jwtService.sign(jwtPayload);

      return {
        user: userRows[0],
        vendorId: vendorRows[0].id,
        onboardingStatus: vendorRows[0].onboarding_status,
        currentStep: vendorRows[0].current_step,
        verificationStatus: vendorRows[0].verification_status,
        token,
        phone: normalizedPhone,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Registration Error:', error);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to register: ' + (error as any).message);
    } finally {
      client.release();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Existing methods below (unchanged)
  // ═══════════════════════════════════════════════════════════════════════════

  async googleLogin(body: any) {
    const { idToken, user_type, mode } = body;
    let ticket;
    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: [
          '900673747557-ato1lrqoib1mn8l2sf3cj1tbqus7s4vk.apps.googleusercontent.com',
          '900673747557-046l7f90qirftvjt0mpn2lb2gqigqm0t.apps.googleusercontent.com'
        ]
      });
    } catch (e) {
      throw new UnauthorizedException('Invalid Google ID Token');
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedException('No email in Google ID Token');
    }

    const email = payload.email;
    const name = payload.name || email.split('@')[0];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let userQuery = await client.query('SELECT u.id, u.name, u.email, u.user_type, u.created_at, v.id as vendor_id, v.onboarding_status, v.current_step, v.verification_status, v.welcome_sent FROM users u LEFT JOIN vendors v ON u.id = v.user_id WHERE u.email = $1', [email]);
      let user;

      if (userQuery.rows.length > 0) {
        user = userQuery.rows[0];
        
        // If they already exist as a user but are missing a vendor profile (and logging in as a vendor)
        if (user_type === 'vendor' && !user.vendor_id) {
          const { rows: vendorRows } = await client.query(
            'INSERT INTO vendors (user_id, company_name, contact_person, email, current_step, onboarding_status) VALUES ($1, $2, $3, $4, 1, \'Started\') RETURNING id as vendor_id, current_step, onboarding_status, verification_status',
            [user.id, user.name, user.name, user.email]
          );
          user = { ...user, ...vendorRows[0], user_type: 'vendor' };
          // Optionally upgrade user_type to vendor if they were a customer
          await client.query('UPDATE users SET user_type = \'vendor\' WHERE id = $1', [user.id]);
        }
      } else {
        if (mode === 'login') {
          throw new UnauthorizedException('Account not found. Please sign up first.');
        }
        const password = Math.random().toString(36).slice(-8); // Random password for oauth
        const type = user_type || 'customer';
        const { rows: userRows } = await client.query(
          'INSERT INTO users (name, email, password, user_type) VALUES ($1, $2, $3, $4) RETURNING id, name, email, user_type, created_at',
          [name, email, password, type]
        );
        user = userRows[0];

        if (type === 'vendor') {
          const { rows: vendorRows } = await client.query(
            'INSERT INTO vendors (user_id, company_name, contact_person, email, current_step, onboarding_status) VALUES ($1, $2, $3, $4, 1, \'Started\') RETURNING id as vendor_id, current_step, onboarding_status, verification_status',
            [user.id, name, name, email]
          );
          user = { ...user, ...vendorRows[0] };
        }
      }
      await client.query('COMMIT');

      if (user_type && user.user_type !== user_type) {
        throw new UnauthorizedException(`Access denied. This portal requires ${user_type} privileges.`);
      }

      if (user.onboarding_status === 'Completed' && user.verification_status !== 'Approved') {
        throw new UnauthorizedException('Your account is pending admin approval. You will be able to log in once approved.');
      }

      // Send welcome notification if it's the first time they log in after getting approved via Google Auth
      if (user.onboarding_status === 'Completed' && user.verification_status === 'Approved' && user.welcome_sent === false) {
        await client.query('UPDATE vendors SET welcome_sent = true WHERE id = $1', [user.vendor_id]);
        this.oneSignalService.sendVendorNotification(
          user.vendor_id,
          'Welcome to CreatorSpace! 🎉',
          'Your account has been fully approved. You can now start receiving bookings!'
        );
      }

      const jwtPayload = { sub: user.id, email: user.email };
      const token = this.jwtService.sign(jwtPayload);

      // Check if phone is already verified
      const phoneRow = await client.query('SELECT phone, phone_verified FROM users WHERE id = $1', [user.id]);
      const phoneVerified = phoneRow.rows[0]?.phone_verified === true;
      const userPhone = phoneRow.rows[0]?.phone || null;

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          user_type: user.user_type,
          created_at: user.created_at
        },
        vendorId: user.vendor_id,
        onboardingStatus: user.onboarding_status || 'Started',
        currentStep: user.current_step || 1,
        verificationStatus: user.verification_status || 'Pending',
        phoneVerified,
        phone: userPhone,
        token
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async register(body: any) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { email, password, metadata, user_type } = body;
      
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        throw new BadRequestException('User already exists');
      }
      
      const { rows: userRows } = await client.query(
        'INSERT INTO users (name, email, password, user_type) VALUES ($1, $2, $3, $4) RETURNING id, name, email, user_type, created_at',
        [metadata?.companyName || metadata?.contactPerson || email, email, password, user_type || 'customer']
      );
      
      const userId = userRows[0].id;
      
      // Create Vendor record
      const { rows: vendorRows } = await client.query(
        'INSERT INTO vendors (user_id, company_name, contact_person, phone, email, current_step, onboarding_status) VALUES ($1, $2, $3, $4, $5, 1, \'Started\') RETURNING id, current_step, onboarding_status',
        [
          userId,
          metadata?.companyName,
          metadata?.contactPerson,
          metadata?.phone,
          email
        ]
      );

      await client.query('COMMIT');
      
      const payload = { sub: userId, email };
      const token = this.jwtService.sign(payload);

      return {
        user: { ...userRows[0] },
        vendorId: vendorRows[0].id,
        onboardingStatus: vendorRows[0].onboarding_status,
        currentStep: vendorRows[0].current_step,
        verificationStatus: vendorRows[0].verification_status,
        token
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Registration Error:', error);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to register user and vendor: ' + error.message);
    } finally {
      client.release();
    }
  }

  async login(body: any) {
    try {
      const { email, password, required_role } = body;
      
      const { rows } = await this.pool.query(
        'SELECT u.id, u.name, u.email, u.password, u.user_type, u.created_at, v.id as vendor_id, v.onboarding_status, v.current_step, v.verification_status, v.welcome_sent FROM users u LEFT JOIN vendors v ON u.id = v.user_id WHERE u.email = $1 AND u.password = $2',
        [email, password]
      );
      
      if (rows.length === 0) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const user = rows[0];

      if (required_role && user.user_type !== required_role) {
        throw new UnauthorizedException(`Access denied. This portal requires ${required_role} privileges.`);
      }

      // If they finished onboarding but admin hasn't approved them yet, block login.
      if (user.onboarding_status === 'Completed' && user.verification_status !== 'Approved') {
        throw new UnauthorizedException('Your account is pending admin approval. You will be able to log in once approved.');
      }

      // If this is the first login after approval, send a welcome notification
      if (user.onboarding_status === 'Completed' && user.verification_status === 'Approved' && user.welcome_sent === false) {
        await this.pool.query('UPDATE vendors SET welcome_sent = true WHERE id = $1', [user.vendor_id]);
        this.oneSignalService.sendVendorNotification(
          user.vendor_id,
          'Welcome to CreatorSpace! 🎉',
          'Your account has been fully approved. You can now start receiving bookings!'
        );
      }

      const payload = { sub: user.id, email: user.email };
      const token = this.jwtService.sign(payload);

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          user_type: user.user_type,
          created_at: user.created_at
        },
        vendorId: user.vendor_id,
        onboardingStatus: user.onboarding_status,
        currentStep: user.current_step,
        verificationStatus: user.verification_status,
        token
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException('Failed to log in');
    }
  }

  // ── Verify and set a new phone number (for Google sign-in users) ──────────
  async verifyNewPhone(userId: string, body: any) {
    const { phone, otp } = body;
    if (!phone || !otp) throw new BadRequestException('Phone and OTP are required');

    const normalizedPhone = phone.startsWith('+91') ? phone : `+91${phone.replace(/^91/, '')}`;
    const localNumber = normalizedPhone.replace('+91', '');

    const isDevMode = !process.env.FAST2SMS_API_KEY;

    // Look up the OTP session in the database
    const { rows: otpRows } = await this.pool.query(
      'SELECT session_id FROM otps WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
      [normalizedPhone]
    );
    if (otpRows.length === 0) throw new BadRequestException('OTP expired or not found. Please request a new one.');
    const sessionId = otpRows[0].session_id;

    if (isDevMode) {
      if (otp !== '123456') throw new UnauthorizedException('Invalid OTP (dev: use 123456)');
    } else {
      // Call Fast2SMS to verify (matching verifyOtp style)
      try {
        const response = await axios.post(
          "https://www.fast2sms.com/dev/otp/verify",
          {
            mobile: localNumber,
            otp: otp,
            otp_id: process.env.FAST2SMS_OTP_ID,
          },
          {
            headers: {
              authorization: process.env.FAST2SMS_API_KEY,
              "Content-Type": "application/json",
              accept: "application/json",
            },
          },
        );

        console.log("FAST2SMS VERIFY (verifyNewPhone):", response.data);

        if (response.data.return !== true) {
          throw new UnauthorizedException(response.data.message || "Invalid OTP");
        }
      } catch (e: any) {
        console.log(e.response?.data || e.message);
        throw new UnauthorizedException("OTP verification failed or invalid code");
      }
    }

    // OTP is valid — update user phone and mark verified
    await this.pool.query('DELETE FROM otps WHERE phone = $1', [normalizedPhone]);
    await this.pool.query(
      'UPDATE users SET phone = $1, phone_verified = true WHERE id = $2',
      [normalizedPhone, userId]
    );
    await this.pool.query(
      'UPDATE vendors SET phone = $1 WHERE user_id = $2',
      [normalizedPhone, userId]
    );

    return { success: true, message: 'Phone number verified successfully.' };
  }
}

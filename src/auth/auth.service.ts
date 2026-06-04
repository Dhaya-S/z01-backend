import { Injectable, Inject, BadRequestException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { Pool } from 'pg';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as Twilio from 'twilio';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  private twilioClient: Twilio.Twilio;
  private verifyServiceSid: string;

  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private jwtService: JwtService
  ) {
    this.googleClient = new OAuth2Client('900673747557-ato1lrqoib1mn8l2sf3cj1tbqus7s4vk.apps.googleusercontent.com');

    // Initialize Twilio client
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || '';

    if (accountSid && authToken) {
      this.twilioClient = Twilio.default(accountSid, authToken);
    }
  }

  // ── Send OTP ──────────────────────────────────────────────────────────────
  async sendOtp(body: any) {
    const { phone } = body;
    if (!phone) throw new BadRequestException('Phone number is required');

    // Normalize phone: ensure it has country code
    const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

    if (!this.twilioClient) {
      throw new InternalServerErrorException('Twilio is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.');
    }

    try {
      const verification = await this.twilioClient.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({
          to: normalizedPhone,
          channel: 'sms',
        });

      return {
        success: true,
        status: verification.status,
        phone: normalizedPhone,
        message: `OTP sent to ${normalizedPhone}`,
      };
    } catch (error: any) {
      console.error('Twilio Send OTP Error:', error.message);
      throw new InternalServerErrorException('Failed to send OTP: ' + error.message);
    }
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────
  async verifyOtp(body: any) {
    const { phone, code, mode } = body; // mode: 'login' | 'signup'
    if (!phone || !code) throw new BadRequestException('Phone and OTP code are required');

    const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

    if (!this.twilioClient) {
      throw new InternalServerErrorException('Twilio is not configured.');
    }

    try {
      const verificationCheck = await this.twilioClient.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks.create({
          to: normalizedPhone,
          code: code,
        });

      if (verificationCheck.status !== 'approved') {
        throw new UnauthorizedException('Invalid or expired OTP');
      }
    } catch (error: any) {
      if (error instanceof UnauthorizedException) throw error;
      console.error('Twilio Verify Error:', error.message);
      throw new UnauthorizedException('OTP verification failed: ' + error.message);
    }

    // OTP is valid — handle based on mode
    if (mode === 'login') {
      return this._loginWithPhone(normalizedPhone);
    } else {
      // signup mode — mark phone as verified
      return this._markPhoneVerified(normalizedPhone);
    }
  }

  // ── Login via phone (after OTP verified) ──────────────────────────────────
  private async _loginWithPhone(phone: string) {
    const { rows } = await this.pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.user_type, u.created_at,
              v.id as vendor_id, v.onboarding_status, v.current_step, v.verification_status
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
  private async _markPhoneVerified(phone: string) {
    const { rows } = await this.pool.query(
      'UPDATE users SET phone_verified = true WHERE phone = $1 RETURNING id, name, email, phone',
      [phone]
    );

    if (rows.length === 0) {
      throw new BadRequestException('No account found with this phone number.');
    }

    return {
      success: true,
      message: 'Phone number verified successfully',
      user: rows[0],
    };
  }

  // ── Register with Phone ───────────────────────────────────────────────────
  async registerWithPhone(body: any) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { name, phone, email, password } = body;

      const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

      // Check if user already exists (by email or phone)
      const existingEmail = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingEmail.rows.length > 0) {
        throw new BadRequestException('An account with this email already exists');
      }

      const existingPhone = await client.query('SELECT id FROM users WHERE phone = $1', [normalizedPhone]);
      if (existingPhone.rows.length > 0) {
        throw new BadRequestException('An account with this phone number already exists');
      }

      // Create user
      const { rows: userRows } = await client.query(
        'INSERT INTO users (name, email, password, phone, user_type, phone_verified) VALUES ($1, $2, $3, $4, $5, false) RETURNING id, name, email, phone, user_type, created_at',
        [name, email, password, normalizedPhone, 'vendor']
      );

      const userId = userRows[0].id;

      // Create vendor record
      const { rows: vendorRows } = await client.query(
        `INSERT INTO vendors (user_id, company_name, contact_person, phone, email, current_step, onboarding_status)
         VALUES ($1, $2, $3, $4, $5, 1, 'Started') RETURNING id, current_step, onboarding_status`,
        [userId, name, name, normalizedPhone, email]
      );

      await client.query('COMMIT');

      // Generate JWT so the app can make authenticated requests during onboarding
      const jwtPayload = { sub: userId, email };
      const token = this.jwtService.sign(jwtPayload);

      // Send OTP for phone verification
      let otpResult: any = { success: false, message: 'Twilio not configured' };
      if (this.twilioClient) {
        try {
          const verification = await this.twilioClient.verify.v2
            .services(this.verifyServiceSid)
            .verifications.create({
              to: normalizedPhone,
              channel: 'sms',
            });
          otpResult = { success: true, status: verification.status };
        } catch (error: any) {
          console.error('Failed to send OTP during registration:', error.message);
          otpResult = { success: false, message: error.message };
        }
      }

      return {
        user: userRows[0],
        vendorId: vendorRows[0].id,
        onboardingStatus: vendorRows[0].onboarding_status,
        currentStep: vendorRows[0].current_step,
        token,
        otpSent: otpResult.success,
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
      let userQuery = await client.query('SELECT u.id, u.name, u.email, u.user_type, u.created_at, v.id as vendor_id, v.onboarding_status, v.current_step, v.verification_status FROM users u LEFT JOIN vendors v ON u.id = v.user_id WHERE u.email = $1', [email]);
      let user;

      if (userQuery.rows.length > 0) {
        user = userQuery.rows[0];
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

      const jwtPayload = { sub: user.id, email: user.email };
      const token = this.jwtService.sign(jwtPayload);

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
        'SELECT u.id, u.name, u.email, u.password, u.user_type, u.created_at, v.id as vendor_id, v.onboarding_status, v.current_step, v.verification_status FROM users u LEFT JOIN vendors v ON u.id = v.user_id WHERE u.email = $1 AND u.password = $2',
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
}

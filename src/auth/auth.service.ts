import { Injectable, Inject, BadRequestException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { Pool } from 'pg';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private jwtService: JwtService
  ) {
    this.googleClient = new OAuth2Client('900673747557-ato1lrqoib1mn8l2sf3cj1tbqus7s4vk.apps.googleusercontent.com');
  }

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

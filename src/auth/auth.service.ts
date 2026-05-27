import { Injectable, Inject, BadRequestException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { Pool } from 'pg';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private jwtService: JwtService
  ) {}

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

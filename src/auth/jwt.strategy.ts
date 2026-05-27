import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
    });
  }

  async validate(payload: any) {
    const { rows } = await this.pool.query('SELECT id, verification_status FROM vendors WHERE user_id = $1', [payload.sub]);
    const vendor = rows.length > 0 ? rows[0] : null;
    
    return { 
      userId: payload.sub, 
      email: payload.email,
      vendorId: vendor ? vendor.id : null,
      verificationStatus: vendor ? vendor.verification_status : null
    };
  }
}

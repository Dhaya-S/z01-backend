import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    return await this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: any) {
    return await this.authService.login(body);
  }

  @Post('google')
  async googleLogin(@Body() body: any) {
    return await this.authService.googleLogin(body);
  }

  // ── OTP Endpoints ─────────────────────────────────────────────────────────

  @Post('send-otp')
  async sendOtp(@Body() body: any) {
    return await this.authService.sendOtp(body);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: any) {
    return await this.authService.verifyOtp(body);
  }


  @UseGuards(AuthGuard('jwt'))
  @Post('verify-new-phone')
  async verifyNewPhone(@Request() req: any, @Body() body: any) {
    return await this.authService.verifyNewPhone(req.user.userId, body);
  }
}

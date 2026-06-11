import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  // ── Unified dashboard endpoint (single-request load) ──────────────────────
  @UseGuards(AuthGuard('jwt'))
  @Get('dashboard')
  async getDashboard(@Request() req: any) {
    return this.vendorsService.getDashboardData(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMyProfile(@Request() req: any) {
    // Assuming the user has one vendor profile linked
    return this.vendorsService.getProfileByUserId(req.user.userId);
  }

  @Get(':id')
  getProfile(@Param('id') id: string) {
    return this.vendorsService.getProfile(id);
  }

  @Get(':id/notifications')
  @UseGuards(AuthGuard('jwt'))
  getNotifications(@Param('id') id: string) {
    return this.vendorsService.getNotifications(id);
  }

  @Post('details')
  @UseGuards(AuthGuard('jwt'))
  updateDetails(@Request() req: any, @Body() details: any) {
    return this.vendorsService.updateDetailsByUserId(req.user.userId, details);
  }

  @Post('documents')
  @UseGuards(AuthGuard('jwt'))
  uploadDocuments(@Request() req: any, @Body() documents: any) {
    return this.vendorsService.updateDocumentsByUserId(req.user.userId, documents);
  }

  @Post('bank-details')
  @UseGuards(AuthGuard('jwt'))
  updateBankDetails(@Request() req: any, @Body() bankDetails: any) {
    return this.vendorsService.updateBankDetailsByUserId(req.user.userId, bankDetails);
  }

  @Put('status')
  @UseGuards(AuthGuard('jwt'))
  updateStatus(@Request() req: any, @Body() body: { currentStep: number, status?: string }) {
    return this.vendorsService.updateOnboardingStatusByUserId(req.user.userId, body.currentStep, body.status);
  }

  @Post('reviews/:reviewId/reply')
  @UseGuards(AuthGuard('jwt'))
  async replyToReview(
    @Param('reviewId') reviewId: string,
    @Body('reply') reply: string,
  ) {
    return this.vendorsService.replyToReview(reviewId, reply);
  }
}

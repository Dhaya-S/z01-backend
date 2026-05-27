import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ManpowerService } from './manpower.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('manpower')
export class ManpowerController {
  constructor(private readonly manpowerService: ManpowerService) {}

  @Get()
  async findAll() {
    return await this.manpowerService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-listings')
  async getMyListings(@Req() req: any) {
    if (!req.user.vendorId) {
      throw new UnauthorizedException('User is not a registered vendor');
    }
    return await this.manpowerService.findAll(req.user.vendorId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Req() req: any, @Body() data: any) {
    if (!req.user.vendorId) {
      throw new UnauthorizedException('User is not a registered vendor');
    }
    if (req.user.verificationStatus !== 'Approved') {
      throw new ForbiddenException('Your vendor account is not yet approved');
    }
    return await this.manpowerService.create(req.user.vendorId, data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async update(@Param('id') id: string, @Req() req: any, @Body() data: any) {
    if (!req.user.vendorId) {
      throw new UnauthorizedException('User is not a registered vendor');
    }
    if (req.user.verificationStatus !== 'Approved') {
      throw new ForbiddenException('Your vendor account is not yet approved');
    }
    return await this.manpowerService.update(parseInt(id), req.user.vendorId, data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    if (!req.user.vendorId) {
      throw new UnauthorizedException('User is not a registered vendor');
    }
    return await this.manpowerService.delete(parseInt(id), req.user.vendorId);
  }
}

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { StudiosService } from './studios.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('studios')
export class StudiosController {
  constructor(private readonly studiosService: StudiosService) {}

  @Get()
  async findAll(@Query('category') category?: string, @Query('date') date?: string) {
    return await this.studiosService.findAll(undefined, date);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-listings')
  async getMyListings(@Req() req: any, @Query('date') date?: string) {
    if (!req.user.vendorId) {
      throw new UnauthorizedException('User is not a registered vendor');
    }
    return await this.studiosService.findAll(req.user.vendorId, date);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Query('date') date?: string) {
    return await this.studiosService.findOne(parseInt(id), date);
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
    return await this.studiosService.create(req.user.vendorId, data);
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
    return await this.studiosService.update(parseInt(id), req.user.vendorId, data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    if (!req.user.vendorId) {
      throw new UnauthorizedException('User is not a registered vendor');
    }
    return await this.studiosService.delete(parseInt(id), req.user.vendorId);
  }
}

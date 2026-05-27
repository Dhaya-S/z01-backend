import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { StudiosService } from './studios.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('studios')
export class StudiosController {
  constructor(private readonly studiosService: StudiosService) {}

  @Get()
  async findAll(@Query('category') category?: string) {
    // Note: If you want to support category filtering here as well, 
    // you might need to update StudiosService.findAll to handle category.
    // For now, returning all as requested for the main app view.
    return await this.studiosService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-listings')
  async getMyListings(@Req() req: any) {
    if (!req.user.vendorId) {
      throw new UnauthorizedException('User is not a registered vendor');
    }
    return await this.studiosService.findAll(req.user.vendorId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.studiosService.findOne(parseInt(id));
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

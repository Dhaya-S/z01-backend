import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get()
  async findAll() {
    return await this.equipmentService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-listings')
  async getMyListings(@Req() req: any) {
    if (!req.user.vendorId) {
      throw new UnauthorizedException('User is not a registered vendor');
    }
    return await this.equipmentService.findAll(req.user.vendorId);
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
    return await this.equipmentService.create(req.user.vendorId, data);
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
    return await this.equipmentService.update(parseInt(id), req.user.vendorId, data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    if (!req.user.vendorId) {
      throw new UnauthorizedException('User is not a registered vendor');
    }
    return await this.equipmentService.delete(parseInt(id), req.user.vendorId);
  }
}

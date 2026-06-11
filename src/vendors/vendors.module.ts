import { Module } from '@nestjs/common';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { DatabaseModule } from '../database/database.module';
import { OneSignalModule } from '../onesignal/onesignal.module';

@Module({
  imports: [DatabaseModule, OneSignalModule],
  controllers: [VendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}

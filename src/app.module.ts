import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { StudiosModule } from './studios/studios.module';
import { EquipmentModule } from './equipment/equipment.module';
import { ManpowerModule } from './manpower/manpower.module';
import { BookingsModule } from './bookings/bookings.module';
import { AuthModule } from './auth/auth.module';
import { VendorsModule } from './vendors/vendors.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    DatabaseModule,
    StudiosModule,
    EquipmentModule,
    ManpowerModule,
    BookingsModule,
    AuthModule,
    VendorsModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

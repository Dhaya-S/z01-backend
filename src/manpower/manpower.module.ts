import { Module } from '@nestjs/common';
import { ManpowerController } from './manpower.controller';
import { ManpowerService } from './manpower.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ManpowerController],
  providers: [ManpowerService],
})
export class ManpowerModule {}

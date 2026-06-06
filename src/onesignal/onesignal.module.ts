import { Module, Global } from '@nestjs/common';
import { OneSignalService } from './onesignal.service';

@Global()
@Module({
  providers: [OneSignalService],
  exports: [OneSignalService],
})
export class OneSignalModule {}

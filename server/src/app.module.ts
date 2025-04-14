import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { TestModule } from './test/test.module';
import { QuestionModule } from './question/question.module';
import { SubmissionModule } from './submission/submission.module';
import { ResponseModule } from './response/response.module';

@Module({
  imports: [
    UserModule,
    TestModule,
    QuestionModule,
    SubmissionModule,
    ResponseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

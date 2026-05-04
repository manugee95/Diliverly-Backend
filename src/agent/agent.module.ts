import { forwardRef, Module } from '@nestjs/common';
import { AgentService } from './providers/agent.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentController } from './agent.controller';
import { UsersModule } from '../users/users.module';
import { User } from '../users/user.entity';
import { YouverifyProvider } from './providers/youverify.provider';
import { HttpModule } from '@nestjs/axios';
import { PaginationProvider } from '../common/pagination/providers/pagination.provider';
import { AuthModule } from '../auth/auth.module';
import { Agent } from './agent.entity';

@Module({
  controllers: [
    AgentController,
  ],
  providers: [
    AgentService,
    YouverifyProvider,
    PaginationProvider,
  ],
  imports: [
    TypeOrmModule.forFeature([Agent, User]),
    forwardRef(() => AuthModule),
    UsersModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
})
export class AgentModule { }

import { forwardRef, Module } from '@nestjs/common';
import { AgentService } from './providers/agent.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentController } from './agent.controller';
import { AgentKycController } from './controllers/agent_kyc.controller';
import { UsersModule } from 'src/users/users.module';
import { User } from 'src/users/user.entity';
import { YouverifyProvider } from './providers/youverify.provider';
import { HttpModule } from '@nestjs/axios';
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider';
import { AuthModule } from 'src/auth/auth.module';
import { Agent } from './agent.entity';

@Module({
  controllers: [
    AgentController,
    AgentKycController
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

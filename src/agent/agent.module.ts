import { forwardRef, Module } from '@nestjs/common';
import { AgentService } from './providers/agent.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from './entities/agent.entity';
import { Agent_KYC } from './entities/agent_kyc.entity';
import { Agent_Bank_Account } from './entities/agent_bank_account.entity';
import { AgentController } from './controllers/agent.controller';
import { AgentKycController } from './controllers/agent_kyc.controller';
import { AgentBankAccountController } from './controllers/agent_bank_account.controller';
import { UsersModule } from 'src/users/users.module';
import { User } from 'src/users/user.entity';
import { YouverifyProvider } from './providers/youverify.provider';
import { AgentKycService } from './providers/agent_kyc.service';
import { HttpModule } from '@nestjs/axios';
import { AgentBankAccountService } from './providers/agent_bank_account.service';
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [
    AgentController,
    AgentKycController,
    AgentBankAccountController,
  ],
  providers: [
    AgentService,
    YouverifyProvider,
    AgentKycService,
    AgentBankAccountService,
    PaginationProvider,
  ],
  imports: [
    TypeOrmModule.forFeature([Agent, Agent_KYC, Agent_Bank_Account, User]),
    forwardRef(() => AuthModule),
    UsersModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
})
export class AgentModule { }

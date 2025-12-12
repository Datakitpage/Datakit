import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { CreditsModule } from './credits/credits.module';
import { AIModule } from './ai/ai.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { PostgresProxyModule } from './postgres-proxy/postgres-proxy.module';
import { getDatabaseConfig } from './config/database.config';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { DatabricksModule } from './databricks/databricks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Disable throttling in test environment
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.NODE_ENV === 'test'
        ) {
          return [];
        }

        return [
          // {
          //   name: 'default',
          //   ttl: 60000, // 1 minute
          //   limit: 100, // 100 requests per minute by default
          // },
          // {
          //   name: 'auth',
          //   ttl: 900000, // 15 minutes
          //   limit: 20, // 20 authentication attempts per 15 minutes
          // },
          {
            name: 'signup',
            ttl: 3600000, // 1 hour
            limit: 60, // 60 signup attempts per hour
          },
        ];
      },
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    WorkspacesModule,
    SubscriptionsModule,
    CreditsModule,
    AIModule,
    WaitlistModule,
    PostgresProxyModule,
    DatabricksModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}

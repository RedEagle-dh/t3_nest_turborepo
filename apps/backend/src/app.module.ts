import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { CryptoModule } from "./crypto/crypto.module";
import { DbModule } from "./db/db.module";
import { RedisModule } from "./redis/redis.module";
import { TRPCModule } from "./trpc/trpc.module";
import { ExampleModule } from './example/example.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			envFilePath: [".env"],
			isGlobal: true,
		}),
		TRPCModule,
		AuthModule,
		DbModule,
		RedisModule,
		CryptoModule,
		ExampleModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}

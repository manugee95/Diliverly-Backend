import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //handle raw Paystack webhook body
  app.use('/withdrawals/webhook/paystack', express.raw({ type: '*/*' }));

  // ---- Validation Pipes ----
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  //Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('DILIVERLY API')
    .setDescription('Use the base API URL as https://diliverly-backend.onrender.com')
    .addServer('http://localhost:3000', 'https://diliverly-backend.onrender.com')
    .setVersion('1.0')
    .build();

  //Instatiate Document
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // ---- Serialization ----
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

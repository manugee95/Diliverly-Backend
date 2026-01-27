import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ---- CORS Configuration ----
  app.enableCors({
    origin: ['https://localhost:3000'], // add your real frontend domain(s) too
    credentials: true,                // only if you use cookies/auth
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

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
      exceptionFactory: (validationErrors) => {
      const errors: Record<string, string[]> = {};

      validationErrors.forEach((err) => {
        const field = err.property;

        errors[field] = Object.values(err.constraints ?? {});
      });

      return new BadRequestException({
        message: 'Validation failed',
        errors,
      });
    },
    }),
  );

  //Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('DILIVERLY API')
    .setDescription('Use the base API URL as https://diliverly-backend.onrender.com')
    .addServer('https://diliverly-backend.onrender.com')
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

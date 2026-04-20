import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

//ALWAYS LOAD ENV FIRST
dotenv.config({
  path: path.resolve(process.cwd(), '.env.development'),
});

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,

  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],

  ssl: false,
});

export default dataSource;

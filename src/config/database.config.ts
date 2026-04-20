// import { DataSourceOptions } from 'typeorm';
// import * as dotenv from 'dotenv';
// import * as path from 'path';

// // FORCE LOAD FROM PROJECT ROOT
// const ENV = process.env.NODE_ENV;

// dotenv.config({
//   path: path.resolve(process.cwd(), !ENV ? '.env' : `.env.${ENV}`),
// });

// const isProd = process.env.NODE_ENV === 'production';

// export const typeOrmConfig: DataSourceOptions = {
//   type: 'postgres',
//   host: process.env.DATABASE_HOST,
//   port: Number(process.env.DATABASE_PORT),
//   username: process.env.DATABASE_USER,
//   password: process.env.DATABASE_PASSWORD,
//   database: process.env.DATABASE_NAME,

//   ssl: isProd
//     ? { rejectUnauthorized: false }
//     : false,

//   entities: ['dist/**/*.entity.js'],
//   migrations: ['dist/migrations/*.js'],
// };

// console.log('==== ENV DEBUG START ====');
// console.log('HOST:', process.env.DATABASE_HOST);
// console.log('USER:', process.env.DATABASE_USER);
// console.log('PASSWORD:', process.env.DATABASE_PASSWORD);
// console.log('DB:', process.env.DATABASE_NAME);
// console.log('==== ENV DEBUG END ====');

// import { registerAs } from '@nestjs/config';

// export default registerAs('database', () => ({
//   host: process.env.DATABASE_HOST || 'postgresql-197498-0.cloudclusters.net',
//   port: process.env.DATABASE_PORT
//     ? parseInt(process.env.DATABASE_PORT, 10)
//     : 5432,
//   user: process.env.DATABASE_USER,
//   password: process.env.DATABASE_PASSWORD,
//   name: process.env.DATABASE_NAME,
// }));
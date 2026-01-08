import { registerAs } from '@nestjs/config';

export default registerAs('appConfig', () => {
  const env = process.env.NODE_ENV ?? 'development';

  return {
    environment: env,
    isProduction: env === 'production',
    isDevelopment: env === 'development',
    isTest: env === 'test',
  };
});

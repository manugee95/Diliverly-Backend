import { Injectable } from '@nestjs/common';

@Injectable()
export class CurrencyConvertProvider {
  toKobo = (naira: number | string) => {
    return Math.round(Number(naira) * 100);
  };

  toNaira = (kobo: number | string) => {
    return Number(kobo) / 100;
  };

  formatNaira = (kobo: number | string) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(Number(kobo) / 100);
  };
}

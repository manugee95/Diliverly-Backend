import { Injectable } from '@nestjs/common';

@Injectable()
export class CurrencyConvertProvider {
  toKobo = (naira: number) => Math.round(naira * 100);
  toNaira = (kobo: number) => kobo / 100;
}

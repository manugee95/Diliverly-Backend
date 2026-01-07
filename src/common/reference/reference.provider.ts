import { Injectable } from '@nestjs/common';

@Injectable()
export class ReferenceProvider {
    public generateTransactionRef(): string {
    const num = Math.floor(100000000 + Math.random() * 900000000); // 9-digit number
    const alpha = Math.random().toString(36).substring(2, 5).toUpperCase(); // 3 letters
    return `D${num}${alpha}`; // e.g., D431442179MIC
  }

  public generateOrderRef(): string {
    const digits = Math.floor(1000 + Math.random() * 9000); // 4 digits
    const chars = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 letters/numbers
    return `DLV-${digits}${chars}`;
  }
}

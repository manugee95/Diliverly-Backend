import { v4 as uuidv4 } from 'uuid';

export const generateTransactionRef = (): string => {
  return uuidv4();
};

export const generateOrderRef = (): string => {
  const digits = Math.floor(1000 + Math.random() * 9000); // 4 digits
  const chars = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 letters/numbers
  return `DLV-${digits}${chars}`;
};

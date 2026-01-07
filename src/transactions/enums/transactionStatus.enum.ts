export enum TransactionStatus {
  PENDING = 'pending',     // Not yet paid to bank account
  SUCCESSFUL = 'successful', // Successfully settled to bank
  FAILED = 'failed', 
}
export const CacheTTL = {
  AgentOrders: 30_000, // 30s
  VendorOrders: 30_000,
  DeliveryRequests: 60_000, // 1min
  UserSignup: 900_000, // 5min
  // ...
} as const;

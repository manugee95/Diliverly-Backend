export interface ActiveUserData {
  id: number;
  email: string;
  isAgent: boolean;
  isVendor: boolean;
  // future-proofing
  // isAdmin?: boolean;
}

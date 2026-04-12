export interface ActiveUserData {
  id: number;
  email: string;
  isAgent: boolean;
  isVendor: boolean;
  activeRole: 'agent' | 'vendor';
}

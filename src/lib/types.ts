// Define the User type globally
export interface User {
  id: string;
  name: string;
  role: 'admin' | 'employee';
  // Add other user-related fields if necessary
  otp_created_at?: string | null; // Optional, relevant for dashboard display
}

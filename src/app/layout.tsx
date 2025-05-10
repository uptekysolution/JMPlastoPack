import type {Metadata} from 'next';
// Removed Geist imports as they were causing issues and not installed
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import the Toaster component
import { AuthProvider } from '@/context/AuthContext'; // Import AuthProvider

export const metadata: Metadata = {
  title: 'J M PlastoPack Pvt. Ltd.', // Changed title
  description: 'Secure Access Management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Apply a basic font stack, consider installing and configuring Geist later if needed */}
      <body className={`antialiased font-sans`}>
        <AuthProvider> {/* Wrap children with AuthProvider */}
          {children}
          <Toaster /> {/* Toaster for notifications */}
        </AuthProvider>
      </body>
    </html>
  );
}


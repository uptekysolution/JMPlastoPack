
'use client';

import React, { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react'; // For loading indicator

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('admin' | 'employee')[]; // Optional: Restrict to specific roles
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // --- Primary Logic in AuthContext ---
    // This useEffect primarily handles role-based access *after* authentication is confirmed.
    // The AuthContext handles the initial auth check and redirection if not authenticated.

    if (!loading && isAuthenticated && user) {
        // If roles are specified and the user's role is not allowed
        if (allowedRoles && !allowedRoles.includes(user.role)) {
            console.warn(`ProtectedRoute: User role '${user.role}' not allowed for this route. Redirecting to their dashboard.`);
            router.push(`/${user.role}/dashboard`); // Redirect to their own dashboard
        }
        // If authenticated and allowed (or no specific roles required), no action needed here.
    }
    // If loading or not authenticated, AuthContext's effect will handle redirection to '/'
    // console.log(`ProtectedRoute check: Loading=${loading}, IsAuth=${isAuthenticated}, UserRole=${user?.role}, Allowed=${allowedRoles}`);

  }, [isAuthenticated, loading, user, allowedRoles, router]);

  // --- Render Logic ---

  // Show loading indicator while the AuthContext is verifying authentication.
  if (loading) {
    return (
        <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
            <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                <p className="text-lg text-slate-700">Verifying access...</p>
            </div>
      </div>
    );
  }

  // If authenticated AND (no specific roles required OR user's role is allowed)
  if (isAuthenticated && user && (!allowedRoles || allowedRoles.includes(user.role))) {
    return <>{children}</>;
  }

  // If not authenticated, or role not allowed, AuthContext will redirect.
  // Return null or a minimal placeholder while redirection occurs.
  // Returning null is usually fine as the redirection should be quick.
  return null;
};

export default ProtectedRoute;

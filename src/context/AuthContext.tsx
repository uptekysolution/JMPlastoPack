'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '../lib/types'; 
import { checkUserExists } from '../lib/auth'; // Import the new checkUserExists function

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => void;
  updateLoggedInUser: (updatedUserData: User) => void; // Add function to update user details
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define the User type if not already defined
// Example:
// export interface User {
//   id: string;
//   name: string;
//   role: 'admin' | 'employee';
// }

// Interval for checking user existence (e.g., every 30 seconds)
const USER_CHECK_INTERVAL = 30 * 1000;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true); // Start with loading true
  const router = useRouter();
  const pathname = usePathname();

  // --- Logout Function ---
   const logout = useCallback(() => {
    console.log("Executing logout...");
    if (typeof window !== 'undefined') {
      localStorage.removeItem('loggedInUserId');
      localStorage.removeItem('loggedInUserName');
      localStorage.removeItem('loggedInUserRole');
    }
    setUser(null);
    setIsAuthenticated(false);
    // Check if not already on the login page before pushing
    if (pathname !== '/') {
       router.push('/'); // Redirect to login page after logout
    }
   }, [router, pathname]); // Include pathname in dependencies

   // --- Function to update logged-in user details ---
   const updateLoggedInUser = useCallback((updatedUserData: User) => {
     console.log(`Updating logged-in user details in context for: ${updatedUserData.id}`);
     if (typeof window !== 'undefined') {
       localStorage.setItem('loggedInUserId', updatedUserData.id);
       localStorage.setItem('loggedInUserName', updatedUserData.name);
       localStorage.setItem('loggedInUserRole', updatedUserData.role);
     }
     setUser(updatedUserData);
     // Ensure isAuthenticated remains true
     if (!isAuthenticated) {
       setIsAuthenticated(true);
     }
   }, [isAuthenticated]); // Depend on isAuthenticated to potentially set it

  // --- Initial Auth Check ---
  useEffect(() => {
    console.log("Auth provider mounted or pathname changed:", pathname);
    let isMounted = true;
    const verifyAuth = async () => {
        setLoading(true); // Set loading true at the start of verification
        try {
            const storedUserId = localStorage.getItem('loggedInUserId');
            const storedUserName = localStorage.getItem('loggedInUserName');
            const storedUserRole = localStorage.getItem('loggedInUserRole') as 'admin' | 'employee' | null;

            if (storedUserId && storedUserName && storedUserRole) {
                console.log(`Found user info in localStorage: ${storedUserId}`);
                // Verify user still exists in the database
                const exists = await checkUserExists(storedUserId);
                if (exists && isMounted) {
                     console.log(`User ${storedUserId} confirmed to exist in DB.`);
                     const loggedInUser: User = { id: storedUserId, name: storedUserName, role: storedUserRole };
                     setUser(loggedInUser);
                     setIsAuthenticated(true);
                } else if (!exists && isMounted) {
                     console.warn(`User ${storedUserId} from localStorage not found in DB. Forcing logout.`);
                     logout(); // User deleted, force logout
                }
            } else {
                 console.log("No user info in localStorage.");
                 if (isMounted) {
                     setUser(null);
                     setIsAuthenticated(false);
                     // Redirect to login if not authenticated and not already on the login page
                     if (pathname !== '/') {
                         console.log("Redirecting to login page (no session).");
                         router.push('/');
                     }
                 }
            }
        } catch (error) {
            console.error("Error during initial auth check:", error);
            if (isMounted) {
                setUser(null);
                setIsAuthenticated(false);
                if (pathname !== '/') {
                    console.log("Redirecting to login page (auth check error).");
                    router.push('/');
                }
            }
        } finally {
            if (isMounted) {
                console.log("Initial auth check finished.");
                setLoading(false); // Finished loading check
            }
        }
    };

    verifyAuth();

    // Cleanup function to set isMounted to false when the component unmounts
    return () => {
        isMounted = false;
        console.log("Auth provider unmounted.");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, logout]); // Rerun check if pathname changes or logout function reference changes


   // --- Periodic User Existence Check ---
   useEffect(() => {
     let intervalId: NodeJS.Timeout | null = null;

     const checkSession = async () => {
       if (isAuthenticated && user?.id) {
         console.log(`Periodic check: Verifying existence of user ${user.id}`);
         const exists = await checkUserExists(user.id);
         if (!exists) {
           console.warn(`Periodic check: User ${user.id} no longer exists. Forcing logout.`);
           logout();
           if (intervalId) clearInterval(intervalId); // Stop checking after logout
         } else {
              console.log(`Periodic check: User ${user.id} still exists.`);
         }
       }
     };

     // Start the interval only if the user is authenticated
     if (isAuthenticated && user?.id) {
       console.log("Starting periodic user existence check.");
       intervalId = setInterval(checkSession, USER_CHECK_INTERVAL);
     } else {
          console.log("User not authenticated, periodic check not started.");
     }

     // Cleanup interval on unmount or when authentication state changes
     return () => {
       if (intervalId) {
         console.log("Stopping periodic user existence check.");
         clearInterval(intervalId);
       }
     };
   }, [isAuthenticated, user, logout]); // Depend on auth state, user, and logout


  // --- Login Function ---
  const login = (userData: User) => {
    console.log(`Login function called for user: ${userData.id}`);
    if (typeof window !== 'undefined') {
      localStorage.setItem('loggedInUserId', userData.id);
      localStorage.setItem('loggedInUserName', userData.name);
      localStorage.setItem('loggedInUserRole', userData.role);
    }
    setUser(userData);
    setIsAuthenticated(true);
    // Redirect after login based on role
    console.log(`Redirecting to /${userData.role}/dashboard`);
    router.push(`/${userData.role}/dashboard`);
  };


  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, login, logout, updateLoggedInUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

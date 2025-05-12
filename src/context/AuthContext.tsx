'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '../lib/types';
import { checkUserExists } from '../lib/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => void;
  updateLoggedInUser: (updatedUserData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_CHECK_INTERVAL = 30 * 1000;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const logout = useCallback(() => {
    if (process.env.NODE_ENV === 'development') console.log("Executing logout...");
    if (typeof window !== 'undefined') {
      localStorage.removeItem('loggedInUserId');
      localStorage.removeItem('loggedInUserName');
      localStorage.removeItem('loggedInUserRole');
    }
    setUser(null);
    setIsAuthenticated(false);
    if (pathname !== '/') {
      router.push('/');
    }
  }, [router, pathname]);

  const updateLoggedInUser = useCallback((updatedUserData: User) => {
    if (process.env.NODE_ENV === 'development') console.log(`Updating logged-in user details for: ${updatedUserData.id}`);
    if (typeof window !== 'undefined') {
      localStorage.setItem('loggedInUserId', updatedUserData.id);
      localStorage.setItem('loggedInUserName', updatedUserData.name);
      localStorage.setItem('loggedInUserRole', updatedUserData.role);
    }
    setUser(updatedUserData);
    if (!isAuthenticated) {
      setIsAuthenticated(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (typeof window === 'undefined') return; // Skip on server

    if (process.env.NODE_ENV === 'development') {
      console.log("Auth provider mounted or pathname changed:", pathname);
    }

    let isMounted = true;

    const verifyAuth = async () => {
      setLoading(true);
      try {
        const storedUserId = localStorage.getItem('loggedInUserId');
        const storedUserName = localStorage.getItem('loggedInUserName');
        const storedUserRole = localStorage.getItem('loggedInUserRole') as 'admin' | 'employee' | null;

        if (storedUserId && storedUserName && storedUserRole) {
          if (process.env.NODE_ENV === 'development') console.log(`Found user info in localStorage: ${storedUserId}`);
          const exists = await checkUserExists(storedUserId);
          if (exists && isMounted) {
            if (process.env.NODE_ENV === 'development') console.log(`User ${storedUserId} confirmed to exist in DB.`);
            setUser({ id: storedUserId, name: storedUserName, role: storedUserRole });
            setIsAuthenticated(true);
          } else if (!exists && isMounted) {
            if (process.env.NODE_ENV === 'development') console.warn(`User ${storedUserId} not found in DB. Logging out.`);
            logout();
          }
        } else if (isMounted) {
          if (process.env.NODE_ENV === 'development') console.log("No user info in localStorage.");
          setUser(null);
          setIsAuthenticated(false);
          if (pathname !== '/') {
            router.push('/');
          }
        }
      } catch (error) {
        console.error("Error during auth check:", error);
        if (isMounted) {
          setUser(null);
          setIsAuthenticated(false);
          if (pathname !== '/') {
            router.push('/');
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    verifyAuth();

    return () => {
      isMounted = false;
      if (process.env.NODE_ENV === 'development') console.log("Auth provider unmounted.");
    };
  }, [pathname, logout]);

  useEffect(() => {
    if (loading) return;

    let intervalId: NodeJS.Timeout | null = null;

    const checkSession = async () => {
      if (isAuthenticated && user?.id) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Periodic check: Verifying user ${user.id}`);
        }
        const exists = await checkUserExists(user.id);
        if (!exists) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`User ${user.id} no longer exists. Logging out.`);
          }
          logout();
          if (intervalId) clearInterval(intervalId);
        }
      }
    };

    if (isAuthenticated && user?.id) {
      if (process.env.NODE_ENV === 'development') {
        console.log("Starting periodic user existence check.");
      }
      intervalId = setInterval(checkSession, USER_CHECK_INTERVAL);
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log("User not authenticated or still loading, periodic check not started.");
      }
    }

    return () => {
      if (intervalId) {
        if (process.env.NODE_ENV === 'development') {
          console.log("Stopping periodic user existence check.");
        }
        clearInterval(intervalId);
      }
    };
  }, [isAuthenticated, user, logout, loading]);

  const login = (userData: User) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Login function called for user: ${userData.id}`);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('loggedInUserId', userData.id);
      localStorage.setItem('loggedInUserName', userData.name);
      localStorage.setItem('loggedInUserRole', userData.role);
    }
    setUser(userData);
    setIsAuthenticated(true);
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

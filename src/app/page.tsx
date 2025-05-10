"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { authenticateUser, getUserRoleAndName } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { ArrowLeft, Loader2, User, KeyRound, ShieldCheck, Factory } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { User as UserType } from '@/lib/types';

type LoginPhase = 'username' | 'credential';

export default function Home() {
  const router = useRouter();
  const { login, isAuthenticated, loading: authLoading, user: authUser } = useAuth();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<LoginPhase>('username');
  const [userInfo, setUserInfo] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated && authUser) {
      console.log(`Already authenticated as ${authUser.name}. Redirecting to dashboard...`);
      router.push(`/${authUser.role}/dashboard`);
    }
  }, [isAuthenticated, authLoading, authUser, router]);

  const handleUsernameSubmit = async () => {
    if (!userId) {
      setErrorMessage("Please enter a User ID.");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const fetchedUserInfo = await getUserRoleAndName(userId);
      if (fetchedUserInfo) {
        const userDetails: UserType = {
          id: userId,
          name: fetchedUserInfo.name,
          role: fetchedUserInfo.role as 'admin' | 'employee',
        };
        setUserInfo(userDetails);
        setPhase('credential');
        setErrorMessage(null);
      } else {
        setErrorMessage("User ID not found.");
        toast({
          variant: "destructive",
          title: "Error",
          description: "User ID not found.",
        });
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
      setErrorMessage("An error occurred while checking the User ID.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCredentialSubmit = async () => {
    if (!userInfo) return;

    const { role, name, id } = userInfo;
    const credential = role === 'admin' ? password : otp;

    if (!credential) {
      setErrorMessage(`Please enter your ${role === 'admin' ? 'password' : 'OTP'}.`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const success = await authenticateUser(id, credential, role);

      if (success) {
        toast({
          title: "Login Successful",
          description: `Welcome, ${name}! Redirecting...`,
        });
        login(userInfo);
      } else {
        setErrorMessage(`Invalid ${role === 'admin' ? 'password' : 'OTP'}.`);
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: `Invalid ${role === 'admin' ? 'password' : 'OTP'}. Please try again.`,
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      setErrorMessage("An unexpected error occurred during login.");
      toast({
        variant: "destructive",
        title: "Login Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setPhase('username');
    setUserInfo(null);
    setPassword("");
    setOtp("");
    setErrorMessage(null);
    setUserId("");
  };

  const renderFormContent = () => {
    if (phase === 'username') {
      return (
        <>
          <div className="flex justify-center mb-6">
            <div className="bg-blue-50 p-3 rounded-full">
              <User className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="userId" className="text-sm font-medium text-slate-700 block">User ID</label>
            <div className="relative">
              <Input
                id="userId"
                type="text"
                placeholder="Enter your User ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm sm:text-base pl-10"
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && userId && handleUsernameSubmit()}
                aria-describedby={errorMessage ? "error-message" : undefined}
                autoFocus
              />
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3">
              <p id="error-message" className="text-sm text-red-600 flex items-center">
                <ShieldCheck className="h-4 w-4 mr-2 text-red-500" /> {errorMessage}
              </p>
            </div>
          )}
          <div className="pt-6">
            <Button
              onClick={handleUsernameSubmit}
              disabled={isLoading || !userId}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 text-sm sm:text-base transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </>
      );
    }

    if (!userInfo) return null;
    const { role, name, id } = userInfo;
    const isAdmin = role === 'admin';

    return (
      <>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleBack} 
          className="absolute top-4 left-4 text-slate-600 hover:text-slate-900 text-sm sm:text-base flex items-center" 
          disabled={isLoading}
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        
        <div className="flex justify-center mb-4">
          <div className={`p-3 rounded-full ${isAdmin ? 'bg-indigo-50' : 'bg-teal-50'}`}>
            {isAdmin ? (
              <ShieldCheck className="h-8 w-8 text-indigo-600" />
            ) : (
              <Factory className="h-8 w-8 text-teal-600" />
            )}
          </div>
        </div>
        
        <div className="text-center mb-6">
          <h3 className="font-medium text-lg text-slate-800">{name}</h3>
          <p className="text-sm text-slate-500 mt-1">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              isAdmin ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'
            }`}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </span>
          </p>
        </div>
        
        {isAdmin ? (
          <div className="space-y-2 pt-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-700 block">Password</label>
            <div className="relative">
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm sm:text-base pl-10"
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && password && handleCredentialSubmit()}
                aria-describedby={errorMessage ? "error-message" : undefined}
                autoFocus
              />
              <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>
        ) : (
          <div className="space-y-2 pt-2">
            <label htmlFor="otp" className="text-sm font-medium text-slate-700 block">One-Time Password (OTP)</label>
            <Input
              id="otp"
              type="text"
              pattern="[A-Za-z0-9]{6}"
              maxLength={6}
              placeholder="Enter 6-character OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.toUpperCase())}
              className="border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 tracking-widest text-center font-mono text-lg"
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && otp.length === 6 && handleCredentialSubmit()}
              aria-describedby={errorMessage ? "error-message otp-description" : "otp-description"}
              autoFocus
            />
            <p id="otp-description" className="text-xs text-slate-500 text-center pt-1 flex items-center justify-center">
              <KeyRound className="h-3 w-3 mr-1 text-slate-400" />
              Request an OTP from your administrator. Valid for 5 minutes.
            </p>
          </div>
        )}
        
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3">
            <p id="error-message" className="text-sm text-red-600 flex items-center">
              <ShieldCheck className="h-4 w-4 mr-2 text-red-500" /> {errorMessage}
            </p>
          </div>
        )}
        
        <div className="pt-6">
          <Button
            onClick={handleCredentialSubmit}
            disabled={isLoading || (isAdmin && !password) || (!isAdmin && otp.length !== 6)}
            className={`w-full text-white text-sm sm:text-base font-medium transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] ${
              isAdmin ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </div>
      </>
    );
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
          <p className="text-lg text-slate-700">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-b-3xl shadow-lg"></div>
        
        <Card className="w-full max-w-sm sm:max-w-md shadow-2xl border-0 relative overflow-hidden bg-white rounded-xl z-10 mt-16 animate-fade-in">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-bl-full opacity-50 -z-0"></div>
          
          <CardHeader className="text-center pt-8 pb-4 px-6">
            {/* <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg flex items-center justify-center mb-4 transform -translate-y-12">
              <Factory className="h-10 w-10 text-white" />
            </div> */}
            <CardTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
              J M PlastoPack
            </CardTitle>
            <CardDescription className="text-slate-500 mt-1">
              Enterprise Management System
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 sm:p-8 space-y-4">
            {renderFormContent()}
          </CardContent>
          
          <div className="text-center text-xs text-slate-400 pb-6">
            © {new Date().getFullYear()} J M PlastoPack Pvt. Ltd. All rights reserved.
          </div>
        </Card>
        
        <Toaster />
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-16 w-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg flex items-center justify-center">
          <Loader2 className="h-10 w-10 text-white animate-spin" />
        </div>
        <p className="text-lg font-medium text-slate-700">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
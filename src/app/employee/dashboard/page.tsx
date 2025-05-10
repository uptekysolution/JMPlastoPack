"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Settings, User, Box, Calendar, Clipboard, LogOut, Loader2 } from "lucide-react"; // Added Loader2
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import ProtectedRoute from '@/components/auth/ProtectedRoute'; // Import ProtectedRoute

function EmployeeDashboardContent() { // Renamed component
  const router = useRouter();
  const { user: loggedInUser, logout } = useAuth(); // Get user and logout from context
  const [greeting, setGreeting] = useState<string | null>(null);
  const [isNavigatingToBopp, setIsNavigatingToBopp] = useState(false); // Add loading state
  // loggedInUserName is now derived from useAuth hook's user object

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  const handleBOPPAccess = () => {
    setIsNavigatingToBopp(true); // Set loading state
    router.push("/bopp-calculator?role=employee");
    // No need to setIsNavigatingToBopp(false) as the component will unmount
  };

  const handleLogout = () => {
    logout(); // Use logout from AuthContext
    // No need for manual redirect here
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  const displayGreeting = greeting && loggedInUser?.name ? `${greeting}, ${loggedInUser.name}` : "Welcome";
  const displayName = loggedInUser?.name || "Employee";

  return (
    <div className="bg-gradient-to-br from-blue-50 to-gray-100 min-h-screen">
      {/* Top Navigation */}
      <nav className="bg-white shadow-md px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="bg-blue-600 w-10 h-10 rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-xl">
                {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">J M PlastoPack Pvt. Ltd.</h1>
        </div>
        <div className="flex items-center space-x-6">
          <button className="text-gray-600 hover:text-blue-600">
            <Bell size={20} />
          </button>
          <button className="text-gray-600 hover:text-blue-600">
            <Settings size={20} />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <User size={16} className="text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">{displayName}</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800">{displayGreeting}</h2>
          <p className="text-gray-600">Welcome to your employee dashboard</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card className="bg-white shadow-md border-0">
              <CardContent className="p-0">
                <div className="flex flex-col">
                  <button className="flex items-center space-x-3 px-4 py-3 border-l-4 border-blue-600 bg-blue-50 text-blue-700 font-medium">
                    <Box size={18} />
                    <span>Products</span>
                  </button>
                  <button className="flex items-center space-x-3 px-4 py-3 border-l-4 border-transparent hover:bg-gray-50 text-gray-700">
                    <Calendar size={18} />
                    <span>Schedule</span>
                  </button>
                  <button className="flex items-center space-x-3 px-4 py-3 border-l-4 border-transparent hover:bg-gray-50 text-gray-700">
                    <Clipboard size={18} />
                    <span>Reports</span>
                  </button>
                  <button className="flex items-center space-x-3 px-4 py-3 border-l-4 border-transparent hover:bg-gray-50 text-gray-700">
                    <Settings size={18} />
                    <span>Settings</span>
                  </button>
                  <button onClick={handleLogout} className="flex items-center space-x-3 px-4 py-3 border-l-4 border-transparent hover:bg-gray-50 text-gray-700 mt-auto">
                    <LogOut size={18} />
                    <span>Log Out</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <Card className="bg-white shadow-md border-0">
              <CardHeader className="pb-0">
                <CardTitle className="text-xl font-bold text-gray-800">Product Tools</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center text-center">
                        <div className="p-4 bg-blue-100 rounded-full mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">BOPP Tape Calculator</h3>
                        <p className="text-gray-600 text-sm mb-4">Access the calculation tool for BOPP tape parameters.</p>
                        <Button
                          onClick={handleBOPPAccess}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition-colors"
                          disabled={isNavigatingToBopp} // Disable button while loading
                        >
                          {isNavigatingToBopp ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Accessing...
                            </>
                          ) : (
                            'Access Tool'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  {/* Add more tool cards here if needed */}
                </div>
              </CardContent>
            </Card>
            {/* Add more dashboard widgets here */}
          </div>
        </div>
      </div>
      <footer className="bg-slate-100 border-t border-slate-200 text-slate-500 py-4 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs">
           <p>© {typeof window !== 'undefined' ? new Date().getFullYear() : ''} J M PlastoPack Pvt. Ltd. All rights reserved.</p>
        </div>
      </footer>
      <Toaster /> {/* Ensure Toaster is present */}
    </div>
  );
}

// Export a wrapper component that uses ProtectedRoute
export default function EmployeeDashboard() {
    return (
        <ProtectedRoute allowedRoles={['employee']}>
            <EmployeeDashboardContent />
        </ProtectedRoute>
    );
}
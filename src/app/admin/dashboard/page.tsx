
"use client";

import { useState, useEffect, useRef } from "react"; // Added useRef
import { useRouter } from "next/navigation";
import Image from "next/image"; // Import next/image
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter, // Added DialogFooter
  DialogClose, // Added DialogClose
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import { deleteUser, getAllUsers, addUser, generateAndStoreOTP, revokeOTP, updateAdminDetails } from "@/lib/auth"; // Added updateAdminDetails
import {
  Plus,
  Trash2,
  Settings,
  ChevronRight,
  User,
  Briefcase,
  Loader2,
  AlertTriangle,
  KeyRound,
  ShieldOff,
  Copy,
  LogOut,
  Bell,
  HelpCircle,
  Database,
  BarChart3,
  Shield,
  Home,
  AlertCircle,
  RefreshCw,
  Save, // Added Save icon
  Menu, // Import Menu icon for mobile
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import ProtectedRoute from '@/components/auth/ProtectedRoute'; // Import ProtectedRoute
import type { User as UserType } from '@/lib/types'; // Use the User type
import jmLogo from '@/app/asset/JM-logo.png';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Removed Tabs components
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


// Renamed User interface to avoid conflict with UserType from types.ts
interface DashboardUser extends UserType {
    // Add specific fields if needed, otherwise UserType might be sufficient
    otp_created_at: string | null;
}


interface OtpDisplayInfo {
  isOpen: boolean;
  userId: string | null;
  userName: string | null;
  otp: string | null;
}

interface DeleteConfirmationInfo {
  isOpen: boolean;
  userId: string | null;
  userName: string | null;
}

function AdminDashboardContent() { // Renamed component to avoid conflict
  const router = useRouter();
  const { user: loggedInUser, logout, updateLoggedInUser } = useAuth(); // Get user, logout, updateLoggedInUser from context
  const [openAddUserDialog, setOpenAddUserDialog] = useState(false);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // State for confirm password
  const [role, setRole] = useState<'admin' | 'employee'>("employee"); // Use specific types
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [admins, setAdmins] = useState<DashboardUser[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true); // Renamed from 'loading'
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [otpDisplayInfo, setOtpDisplayInfo] = useState<OtpDisplayInfo>({
    isOpen: false,
    userId: null,
    userName: null,
    otp: null,
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationInfo>({
    isOpen: false,
    userId: null,
    userName: null,
  });
  const [isNavigatingToBopp, setIsNavigatingToBopp] = useState(false); // Loading state for BOPP navigation

  // --- State for System Settings Dialog ---
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [newName, setNewName] = useState(loggedInUser?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Ref for sections
  const userManagementSectionRef = useRef<HTMLElement>(null);
  const enterpriseToolsSectionRef = useRef<HTMLElement>(null); // Ref for Enterprise Tools
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);


  // Update newName if loggedInUser changes (e.g., after context update)
  useEffect(() => {
     if (loggedInUser) {
         setNewName(loggedInUser.name);
     }
  }, [loggedInUser]);

  // Reset settings form when dialog closes
  useEffect(() => {
      if (!isSettingsDialogOpen) {
          setNewPassword('');
          setConfirmNewPassword('');
          setSettingsError(null);
          setNewName(loggedInUser?.name || ''); // Reset name to current user's name
      }
  }, [isSettingsDialogOpen, loggedInUser]);


  const companyName = "J M PlastoPack Pvt. Ltd.";


  // Reset Add User form when dialog closes or role changes
  useEffect(() => {
    if (!openAddUserDialog) {
      setUserId("");
      setUserName("");
      setPassword("");
      setConfirmPassword(""); // Reset confirm password
      setRole("employee");
      setErrorMessage(null);
    }
  }, [openAddUserDialog]);

  // Reset passwords when role changes to employee
  useEffect(() => {
    if (role === 'employee') {
        setPassword("");
        setConfirmPassword("");
    }
  }, [role]);


  useEffect(() => {
    fetchUsers();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setActionLoading(prev => ({...prev, fetch: true})); // Indicate fetch is loading
    try {
      const allUsers: UserType[] = await getAllUsers(); // Expect UserType[]
      // Adapt to DashboardUser if needed, or just use UserType
      const dashboardUsers = allUsers.map(u => ({ ...u, otp_created_at: (u as any).otp_created_at || null })) as DashboardUser[];
      setUsers(dashboardUsers.filter((user) => user.role === "employee"));
      setAdmins(dashboardUsers.filter((user) => user.role === "admin"));
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch users.",
      });
    } finally {
      setLoadingUsers(false);
      setActionLoading(prev => ({...prev, fetch: false})); // Indicate fetch finished
    }
  };

  const handleAddEmployee = async () => {
    setErrorMessage(null); // Reset error message at the start

    // Basic required field checks
    if (!userId || !userName || !role) {
      setErrorMessage("User ID, Name, and Role are required.");
      return;
    }

    // Admin specific checks
    if (role === 'admin') {
        if (!password) {
            setErrorMessage("Password is required for admin users.");
            return;
        }
        if (password.length < 4) { // Basic password length check
            setErrorMessage("Admin password must be at least 4 characters long.");
            return;
        }
        if (password !== confirmPassword) {
            setErrorMessage("Passwords do not match.");
            return;
        }
    }


    setIsAddingUser(true);
    // For employees, the password field is just a placeholder in the DB
    const passwordToSend = role === 'admin' ? password : 'employee_otp_login';

    try {
      const result = await addUser(userId, userName, passwordToSend, role);
      if (result.success) {
        setOpenAddUserDialog(false); // Close dialog on success
        await fetchUsers(); // Refresh the user list
        toast({
          title: "Success",
          description: "User added successfully!",
        });
      } else {
        // Display the error message from the backend if available
        setErrorMessage(result.message || "Failed to add user. The User ID might already exist.");
        toast({ // Add toast for failure as well
          variant: "destructive",
          title: "Error Adding User",
          description: result.message || "Failed to add user. The User ID might already exist.",
        });
      }
    } catch (error) {
      console.error("Failed to add user:", error);
      setErrorMessage("An unexpected error occurred while adding the user.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred.",
      });
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = (id: string, name: string) => {
     // Prevent deleting the currently logged-in user
    if (loggedInUser && id === loggedInUser.id) {
        toast({
          variant: "destructive",
          title: "Action Denied",
          description: "You cannot delete your own account.",
        });
        return;
    }
    if (id === "admin") {
      toast({
        variant: "destructive",
        title: "Action Denied",
        description: `The default '${id}' account cannot be deleted.`,
      });
      return;
    }
    setDeleteConfirmation({ isOpen: true, userId: id, userName: name });
  };

  const confirmDeleteUser = async () => {
    const id = deleteConfirmation.userId;
    const name = deleteConfirmation.userName;

    if (!id || !name) return;

    // Double-check self-deletion
     if (loggedInUser && id === loggedInUser.id) {
        toast({
            variant: "destructive",
            title: "Action Denied",
            description: "You cannot delete your own account.",
        });
        setDeleteConfirmation({ isOpen: false, userId: null, userName: null });
        return;
     }
     if (id === "admin") {
        toast({
            variant: "destructive",
            title: "Action Denied",
            description: `The default '${id}' account cannot be deleted.`,
        });
        setDeleteConfirmation({ isOpen: false, userId: null, userName: null });
        return;
     }

    setActionLoading(prev => ({ ...prev, [`delete_${id}`]: true }));
    setDeleteConfirmation({ isOpen: false, userId: null, userName: null });

    try {
      console.log(`Frontend: Requesting deletion of user ${id}`);
      const response = await deleteUser(id);
      console.log(`Frontend: Deletion response for user ${id}:`, response);

      if (response.success) { // Check success property
        // await fetchUsers(); // Refetch users to update lists immediately
         setUsers(prevUsers => prevUsers.filter(user => user.id !== id)); // Optimistic update
         setAdmins(prevAdmins => prevAdmins.filter(admin => admin.id !== id)); // Optimistic update
        toast({
          title: "Success",
          description: `User "${name}" deleted successfully!`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Deletion Failed",
          description: response?.message || `Could not delete user "${name}". They might be protected or an error occurred.`,
        });
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred while deleting the user.",
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [`delete_${id}`]: false }));
    }
  };

  const handleGenerateOTP = async (userId: string, userName: string) => {
    setActionLoading(prev => ({ ...prev, [`otp_${userId}`]: true }));
    try {
      const result = await generateAndStoreOTP(userId);
      if (result.success && result.otp) {
        await fetchUsers(); // Refresh user list to show updated OTP status (await)
        setOtpDisplayInfo({
          isOpen: true,
          userId: userId,
          userName: userName,
          otp: result.otp,
        });
        toast({
          title: "OTP Generated",
          description: `OTP generated successfully for ${userName}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "OTP Generation Failed",
          description: result.message || `Failed to generate OTP for ${userName}.`,
        });
      }
    } catch (error) {
      console.error("OTP Generation Error:", error);
      toast({
        variant: "destructive",
        title: "OTP Generation Error",
        description: `An unexpected error occurred while generating OTP for ${userName}.`,
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [`otp_${userId}`]: false }));
    }
  };

  const copyToClipboard = (text: string | null) => {
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        toast({ title: "Copied!", description: "OTP copied to clipboard." });
      }, (err) => {
        toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy OTP." });
        console.error('Could not copy text: ', err);
      });
    }
  };

  const handleRevokeOTP = async (userId: string, userName: string) => {
    setActionLoading(prev => ({ ...prev, [`revoke_${userId}`]: true }));
    try {
      const result = await revokeOTP(userId);
      if (result.success) {
        await fetchUsers(); // Refresh user list (await)
        toast({
          title: "OTP Revoked",
          description: `OTP for ${userName} (ID: ${userId}) has been revoked.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "OTP Revocation Failed",
          description: result.message || `Failed to revoke OTP for ${userName}.`,
        });
      }
    } catch (error) {
      console.error("OTP Revocation Error:", error);
      toast({
        variant: "destructive",
        title: "OTP Revocation Error",
        description: `An unexpected error occurred while revoking OTP for ${userName}.`,
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [`revoke_${userId}`]: false }));
    }
  };

  const handleBOPPAccess = () => {
    setIsNavigatingToBopp(true); // Set loading state
    // Simulate navigation delay if needed, or just navigate directly
    router.push("/bopp-calculator?role=admin");
    // No need to setIsNavigatingToBopp(false) here as the component will unmount
  };

  const getOtpStatus = (otpTimestamp: string | null): { status: 'active' | 'expired' | 'none'; badgeVariant: 'default' | 'destructive' | 'secondary' } => {
    if (!otpTimestamp) {
      return { status: 'none', badgeVariant: 'secondary' };
    }
    try {
        const otpCreatedAt = new Date(otpTimestamp).getTime();
        if (isNaN(otpCreatedAt)) {
            console.warn(`Invalid OTP timestamp format for user: ${otpTimestamp}`);
            return { status: 'none', badgeVariant: 'secondary' }; // Treat invalid date as 'none'
        }
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        if (now - otpCreatedAt < fiveMinutes) {
        return { status: 'active', badgeVariant: 'default' };
        } else {
        return { status: 'expired', badgeVariant: 'destructive' };
        }
    } catch (e) {
        console.error("Error processing OTP timestamp:", e, "Timestamp:", otpTimestamp);
        return { status: 'none', badgeVariant: 'secondary' }; // Fallback on error
    }
  };

  const handleLogout = () => {
    logout(); // Use logout from AuthContext
    // No need for manual redirect here, logout handles it
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  // --- Handler for Saving System Settings ---
   const handleSaveSettings = async () => {
       setSettingsError(null);

       if (!newName.trim()) {
           setSettingsError("Name cannot be empty.");
           return;
       }

       if (newPassword && newPassword !== confirmNewPassword) {
           setSettingsError("Passwords do not match.");
           return;
       }
        if (newPassword && newPassword.length < 4) { // Basic length check
           setSettingsError("New password must be at least 4 characters long.");
           return;
       }

       setIsSavingSettings(true);

       try {
           if (!loggedInUser) throw new Error("Not logged in");

           const result = await updateAdminDetails(loggedInUser.id, newName, newPassword || undefined);

           if (result.success) {
                toast({
                  title: "Success",
                  description: "Your details have been updated.",
                });
                 // Update the user context immediately
                 const updatedUser: UserType = {
                     ...loggedInUser,
                     name: newName,
                 };
                 updateLoggedInUser(updatedUser); // Update context
               setIsSettingsDialogOpen(false); // Close dialog on success
           } else {
               setSettingsError(result.message || "Failed to update details.");
               toast({
                 variant: "destructive",
                 title: "Update Failed",
                 description: result.message || "An error occurred while updating details.",
               });
           }
       } catch (error: any) {
           console.error("Failed to save settings:", error);
           setSettingsError("An unexpected error occurred.");
            toast({
                 variant: "destructive",
                 title: "Error",
                 description: "An unexpected error occurred.",
            });
       } finally {
           setIsSavingSettings(false);
       }
   };

   // Function to handle scrolling to a section
   const handleScrollToSection = (ref: React.RefObject<HTMLElement>) => (event?: React.MouseEvent<HTMLButtonElement | HTMLDivElement>) => { // Make event optional
       event?.preventDefault();
       if (ref.current) {
           ref.current.scrollIntoView({ behavior: 'smooth' });
       }
        setIsMobileMenuOpen(false); // Close mobile menu after navigation
   };


  const renderUserList = (userList: DashboardUser[], type: 'employee' | 'admin') => {
    if (loadingUsers || actionLoading['fetch']) { // Check general loading and fetch specific loading
      return (
        <div className="py-8 text-center text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="font-medium">Loading data...</span>
        </div>
      );
    }
    if (userList.length === 0) {
      return (
        <div className="py-10 text-center">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            {type === 'employee' ? <Briefcase className="h-8 w-8 text-slate-400" /> : <User className="h-8 w-8 text-slate-400" />}
          </div>
          <p className="text-slate-600 font-medium">No {type}s found</p>
          <p className="text-sm text-slate-500 mt-1">Add new {type}s using the "Add User" button</p>
        </div>
      );
    }

    const currentUserId = loggedInUser?.id; // Get ID from loggedInUser

    return (
      <ul className="divide-y divide-slate-200">
        {userList.map((user) => {
          const otpInfo = type === 'employee' ? getOtpStatus(user.otp_created_at) : null;
          const isActionInProgress = actionLoading[`delete_${user.id}`] || actionLoading[`otp_${user.id}`] || actionLoading[`revoke_${user.id}`];
          const isCurrentUser = user.id === currentUserId;
          const isProtectedAdmin = user.id === 'admin';

          return (
            <li key={user.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 py-4 hover:bg-blue-50 transition-colors">
              <div className="flex items-center space-x-4 mb-2 sm:mb-0">
                <Avatar className={`h-10 w-10 ${type === 'admin' ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
                  <AvatarFallback className={`${type === 'admin' ? 'text-amber-700' : 'text-blue-700'} font-semibold`}>
                    {user.name?.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-slate-800 font-medium">{user.name || 'N/A'}</p>
                  <div className="flex items-center text-xs text-slate-500 mt-0.5">
                    <span>ID: {user.id}</span>
                    <span className="mx-1.5">•</span>
                    <span className="capitalize font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">{user.role}</span>

                    {type === 'employee' && otpInfo && otpInfo.status !== 'none' && (
                      <>
                        <span className="mx-1.5">•</span>
                        <Badge variant={otpInfo.badgeVariant} className="text-xs capitalize py-0 px-1.5">
                          OTP: {otpInfo.status}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <TooltipProvider>
                  {type === 'employee' && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGenerateOTP(user.id, user.name)}
                            className="text-slate-600 hover:text-blue-700 hover:bg-blue-100 p-2 h-9 rounded-md disabled:opacity-50"
                            disabled={isActionInProgress}
                          >
                            {actionLoading[`otp_${user.id}`] ?
                              <Loader2 size={18} className="animate-spin" /> :
                              <KeyRound size={18} />
                            }
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Generate new OTP</p>
                        </TooltipContent>
                      </Tooltip>

                      {otpInfo?.status !== 'none' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeOTP(user.id, user.name)}
                              className="text-slate-600 hover:text-amber-700 hover:bg-amber-50 p-2 h-9 rounded-md disabled:opacity-50"
                              disabled={isActionInProgress}
                            >
                              {actionLoading[`revoke_${user.id}`] ?
                                <Loader2 size={18} className="animate-spin" /> :
                                <ShieldOff size={18} />
                              }
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="text-xs">Revoke OTP</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id, user.name)}
                        className="text-slate-600 hover:text-red-700 hover:bg-red-50 p-2 h-9 rounded-md disabled:opacity-50"
                        disabled={isActionInProgress || isCurrentUser || isProtectedAdmin}
                      >
                        {actionLoading[`delete_${user.id}`] ?
                          <Loader2 size={18} className="animate-spin" /> :
                          <Trash2 size={18} />
                        }
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                       <p className="text-xs">
                        {isCurrentUser
                            ? 'Cannot delete self'
                            : isProtectedAdmin
                            ? 'Cannot delete default admin'
                            : 'Delete user'}
                       </p>
                    </TooltipContent>
                  </Tooltip>

                   {(isProtectedAdmin || user.id === 'employee') && (
                     <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-200">
                       Protected
                     </Badge>
                   )}
                   {isCurrentUser && !isProtectedAdmin && user.id !== 'employee' && (
                     <Badge variant="outline" className="text-xs bg-blue-50 text-blue-800 border-blue-200">
                       You
                     </Badge>
                   )}
              </TooltipProvider>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto">
          <div className="px-4 sm:px-6 py-3 flex justify-between items-center border-b border-blue-800/30">
            <div className="flex items-center space-x-2">
              <Image src={jmLogo} alt={companyName} width={32} height={32} className="rounded" data-ai-hint="logo" />
              <h1 className="text-lg font-semibold tracking-tight">{companyName}</h1>
            </div>

            {/* Desktop User Info & Actions */}
            <div className="hidden md:flex items-center space-x-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                     <Button variant="ghost" size="sm" className="text-blue-100 hover:text-white hover:bg-blue-800/50">
                       <Bell size={18} />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">Notifications</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                       <Button variant="ghost" size="sm" className="text-blue-100 hover:text-white hover:bg-blue-800/50">
                         <HelpCircle size={18} />
                       </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p className="text-xs">Help & Support</p></TooltipContent>
                </Tooltip>
             </TooltipProvider>
              <div className="flex items-center space-x-2 ml-2">
                <Avatar className="h-8 w-8 border-2 border-blue-700">
                  <AvatarFallback className="bg-blue-700 text-white text-xs font-medium">
                    {loggedInUser?.name ? loggedInUser.name.charAt(0).toUpperCase() : '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="text-sm hidden sm:block">
                  <p className="font-medium">{loggedInUser?.name || 'Admin'}</p>
                </div>
              </div>
               <TooltipProvider>
                  <Tooltip>
                      <TooltipTrigger asChild>
                           <Button variant="ghost" size="sm" className="text-blue-100 hover:text-white hover:bg-blue-800/50" onClick={handleLogout}>
                             <LogOut size={18} />
                           </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                           <p className="text-xs">Log Out</p>
                      </TooltipContent>
                  </Tooltip>
               </TooltipProvider>
            </div>

            {/* Mobile Menu Trigger */}
             <div className="md:hidden">
                <DropdownMenu open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-blue-100 hover:text-white hover:bg-blue-800/50">
                            <Menu size={24} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-blue-900 border-blue-800 text-white">
                        <DropdownMenuItem className="flex items-center gap-2 focus:bg-blue-800 focus:text-white" onClick={() => setIsMobileMenuOpen(false)}>
                             <Avatar className="h-8 w-8 border-2 border-blue-700">
                               <AvatarFallback className="bg-blue-700 text-white text-xs font-medium">
                                 {loggedInUser?.name ? loggedInUser.name.charAt(0).toUpperCase() : '?'}
                               </AvatarFallback>
                             </Avatar>
                             <span>{loggedInUser?.name || 'Admin'}</span>
                        </DropdownMenuItem>
                        <Separator className="bg-blue-800/50 my-1" />
                        <DropdownMenuItem className="flex items-center gap-2 focus:bg-blue-800 focus:text-white"
                            onClick={() => { setIsSettingsDialogOpen(true); setIsMobileMenuOpen(false); }}>
                            <Settings size={16} /> System Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-2 focus:bg-blue-800 focus:text-white">
                            <Bell size={16} /> Notifications
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-2 focus:bg-blue-800 focus:text-white">
                             <HelpCircle size={16} /> Help & Support
                        </DropdownMenuItem>
                        <Separator className="bg-blue-800/50 my-1" />
                        <DropdownMenuItem className="flex items-center gap-2 focus:bg-red-600 focus:text-white" onClick={handleLogout}>
                            <LogOut size={16} /> Log Out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
            <div>
              <h2 className="text-2xl font-bold">Administration Portal</h2>
              <p className="text-blue-200 mt-1 text-sm">Manage system users, access controls, and enterprise tools</p>
            </div>
            <div className="w-full sm:w-auto hidden md:block"> {/* Hide settings button on mobile, access via dropdown */}
               <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                  <DialogTrigger asChild>
                     <Button variant="outline" size="sm" className="bg-blue-800/40 border-blue-700 text-white hover:bg-blue-800 hover:text-white w-full sm:w-auto">
                       <Settings size={16} className="mr-1.5" />
                       System Settings
                     </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                     <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
                        <DialogTitle className="text-xl font-bold text-slate-800">System Settings</DialogTitle>
                        <DialogDescription className="text-slate-500 mt-1">
                           Update your administrator account details.
                        </DialogDescription>
                     </DialogHeader>
                     <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                           <Label htmlFor="newName" className="text-slate-700 text-sm font-medium">Your Name</Label>
                           <Input
                              id="newName"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              placeholder="Enter your display name"
                              className="border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 text-sm"
                           />
                        </div>
                         <Separator className="my-4" />
                        <h4 className="text-md font-semibold text-slate-700">Change Password (Optional)</h4>
                        <div className="space-y-1.5">
                           <Label htmlFor="newPassword" className="text-slate-700 text-sm font-medium">New Password</Label>
                           <Input
                              type="password"
                              id="newPassword"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Enter new password"
                              className="border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 text-sm"
                           />
                        </div>
                        <div className="space-y-1.5">
                           <Label htmlFor="confirmNewPassword" className="text-slate-700 text-sm font-medium">Confirm New Password</Label>
                           <Input
                              type="password"
                              id="confirmNewPassword"
                              value={confirmNewPassword}
                              onChange={(e) => setConfirmNewPassword(e.target.value)}
                              placeholder="Confirm new password"
                              className={`border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 text-sm ${newPassword && confirmNewPassword && newPassword !== confirmNewPassword ? 'border-red-500 ring-red-500' : ''}`}
                           />
                        </div>
                         {settingsError && (
                           <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800 flex items-start">
                             <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                             <p className="ml-2">{settingsError}</p>
                           </div>
                         )}
                     </div>
                      <DialogFooter className="px-6 pb-6 pt-0">
                        <DialogClose asChild>
                           <Button variant="outline" className="hover:bg-slate-50">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="bg-blue-600 hover:bg-blue-700 text-white">
                           {isSavingSettings ? (
                             <>
                               <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                               Saving...
                             </>
                           ) : (
                             <>
                                <Save size={16} className="mr-1.5"/>
                                Save Changes
                             </>
                           )}
                         </Button>
                     </DialogFooter>
                  </DialogContent>
               </Dialog>
            </div>
          </div>

          {/* Navigation Tabs - Visible on all screen sizes */}
          <div className="flex space-x-1 px-4 sm:px-6 pb-2 overflow-x-auto">
            <Button variant="ghost" size="sm" className="text-white bg-white/10 hover:bg-white/20 rounded-t-md rounded-b-none border-b-2 border-white px-4 py-2 h-auto flex-shrink-0">
              <Home size={16} className="mr-1.5" />
              Dashboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-200 hover:text-white hover:bg-white/10 rounded-t-md rounded-b-none px-4 py-2 h-auto flex-shrink-0"
              onClick={handleScrollToSection(userManagementSectionRef)}
            >
              <User size={16} className="mr-1.5" />
              User Management
            </Button>
             <Button
               variant="ghost"
               size="sm"
               className="text-blue-200 hover:text-white hover:bg-white/10 rounded-t-md rounded-b-none px-4 py-2 h-auto flex-shrink-0"
               onClick={handleScrollToSection(enterpriseToolsSectionRef)}
             >
               <Shield size={16} className="mr-1.5" />
               Tools
             </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Card className="border-0 shadow-md bg-white overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Total Users</p>
                      {loadingUsers ? <Loader2 className="h-6 w-6 animate-spin text-blue-600 mt-1" /> : <h3 className="text-2xl font-bold text-slate-800 mt-1">{users.length + admins.length}</h3>}
                    </div>
                    <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex items-center mt-3">
                    <Badge variant="outline" className="text-xs text-emerald-700 bg-emerald-50 border-emerald-200">
                      +0 today {/* Placeholder */}
                    </Badge>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Active OTPs</p>
                       {loadingUsers ? <Loader2 className="h-6 w-6 animate-spin text-amber-600 mt-1" /> : <h3 className="text-2xl font-bold text-slate-800 mt-1"> {users.filter(u => getOtpStatus(u.otp_created_at).status === 'active').length}</h3>}
                    </div>
                    <div className="h-12 w-12 bg-amber-50 rounded-lg flex items-center justify-center">
                      <KeyRound className="h-6 w-6 text-amber-600" />
                    </div>
                  </div>
                  <div className="flex items-center mt-3">
                    <Badge variant="outline" className="text-xs text-blue-700 bg-blue-50 border-blue-200">
                      Updated live
                    </Badge>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">System Status</p>
                      <h3 className="text-2xl font-bold text-slate-800 mt-1">Operational</h3>
                    </div>
                    <div className="h-12 w-12 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <Shield className="h-6 w-6 text-emerald-600" />
                    </div>
                  </div>
                  <div className="flex items-center mt-3">
                    <Badge variant="outline" className="text-xs text-emerald-700 bg-emerald-50 border-emerald-200">
                      All systems normal
                    </Badge>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Last Updated</p>
                      <h3 className="text-2xl font-bold text-slate-800 mt-1">Just now</h3>
                    </div>
                    <div className="h-12 w-12 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Database className="h-6 w-6 text-slate-600" />
                    </div>
                  </div>
                   <div className="flex items-center mt-3">
                    <p className="text-xs text-slate-500">
                     {typeof window !== 'undefined' ? new Date().toLocaleDateString('en-US', { // Check window availability
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : ''}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section ref={userManagementSectionRef} className="lg:col-span-2 space-y-6 scroll-mt-24 md:scroll-mt-32"> {/* Adjusted scroll-mt */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">User Management</h3>
                <p className="text-sm text-slate-500 mt-1">Manage enterprise users and authentication</p>
              </div>

              <Dialog open={openAddUserDialog} onOpenChange={setOpenAddUserDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium w-full sm:w-auto">
                    <Plus size={16} className="mr-1.5" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
                    <DialogTitle className="text-xl font-bold text-slate-800">Create New User</DialogTitle>
                    <DialogDescription className="text-slate-500 mt-1">
                      Add a new user account to the enterprise system
                    </DialogDescription>
                  </DialogHeader>

                  <div className="p-6 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="role" className="text-slate-700 text-sm font-medium">User Role</Label>
                      <select
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'admin' | 'employee')}
                        className="w-full p-2 border border-slate-300 rounded-md bg-white text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 text-sm"
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="userId" className="text-slate-700 text-sm font-medium">User ID</Label>
                      <Input
                        id="userId"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        placeholder="e.g., jsmith"
                        className="border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="userName" className="text-slate-700 text-sm font-medium">Full Name</Label>
                      <Input
                        id="userName"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="e.g., John Smith"
                        className="border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 text-sm"
                      />
                    </div>

                    {role === 'admin' && (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="password" className="text-slate-700 text-sm font-medium">Password</Label>
                          <Input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter secure password"
                            className="border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="confirmPassword" className="text-slate-700 text-sm font-medium">Confirm Password</Label>
                          <Input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm admin password"
                            className={`border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 text-sm ${password && confirmPassword && password !== confirmPassword ? 'border-red-500 ring-red-500' : ''}`}
                          />
                        </div>
                      </>
                    )}

                    {role === 'employee' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 pt-0.5">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-600">
                              <path d="M12 16V12M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            </div>
                          <div className="ml-2">
                            <p className="text-sm font-medium">Employees log in using One-Time Passwords (OTPs)</p>
                            <p className="text-xs mt-1">After creating the account, you'll need to generate an OTP for this user's first login via the User Management list.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {errorMessage && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800 flex items-start">
                        <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="ml-2">{errorMessage}</p>
                      </div>
                    )}

                    <div className="pt-3">
                      <Button onClick={handleAddEmployee} disabled={isAddingUser} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-10">
                        {isAddingUser ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Account...
                          </>
                        ) : (
                          'Create Account'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="border border-slate-200 shadow-md rounded-lg overflow-hidden">
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="employee-accounts">
                  <AccordionTrigger className="px-6 py-4 hover:bg-slate-50 transition-colors data-[state=open]:bg-slate-50 data-[state=open]:border-b border-slate-200">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Briefcase size={16} className="text-blue-700" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm sm:text-base">Employee Accounts</p>
                        <p className="text-xs text-slate-500">Manage standard user accounts</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 border-t border-slate-100">
                    {renderUserList(users, 'employee')}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="admin-accounts">
                  <AccordionTrigger className="px-6 py-4 hover:bg-slate-50 transition-colors data-[state=open]:bg-slate-50 data-[state=open]:border-b-0 border-slate-200">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <User size={16} className="text-amber-700" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm sm:text-base">Administrator Accounts</p>
                        <p className="text-xs text-slate-500">Manage privileged user accounts</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 border-t border-slate-100">
                    {renderUserList(admins, 'admin')}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          </section>

          <section ref={enterpriseToolsSectionRef} className="space-y-6 scroll-mt-24 md:scroll-mt-32"> {/* Added ref and scroll-mt */}
            <div>
              <h3 className="text-xl font-bold text-slate-800">Enterprise Tools</h3>
              <p className="text-sm text-slate-500 mt-1">Access authorized enterprise applications</p>
            </div>

            <div className="space-y-4">
              <Card
                onClick={handleBOPPAccess}
                className="border border-slate-200 shadow-md rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer group bg-gradient-to-br from-white to-slate-50"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-teal-100 text-teal-700 w-12 h-12 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="16" height="20" x="4" y="2" rx="2"/>
                        <line x1="8" x2="16" y1="6" y2="6"/>
                        <line x1="16" x2="16" y1="14" y2="18"/>
                        <path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>
                      </svg>
                    </div>
                    <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                     {isNavigatingToBopp ? (
                       <Loader2 size={20} className="text-teal-600 animate-spin" />
                     ) : (
                       <ChevronRight size={20} className="text-slate-400 group-hover:text-teal-600 transition-colors" />
                     )}
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-800 mb-1">{companyName} BOPP Tape Calculator</h4>
                  <p className="text-sm text-slate-600 mb-3">Advanced computation tool for BOPP tape parameters and specifications</p>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      Manufacturing
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700 border-slate-200">
                      Engineering
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        </div>
      </main>

      <AlertDialog open={otpDisplayInfo.isOpen} onOpenChange={(open) => setOtpDisplayInfo(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent className="bg-white rounded-lg max-w-md">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-xl font-bold text-slate-800">One-Time Password</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              Generated for <span className="font-medium text-blue-600">{otpDisplayInfo.userName}</span>. Valid for 5 minutes only.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-4">
            <div className="flex items-center justify-center space-x-3 bg-blue-50 p-6 rounded-md border border-blue-200">
              <span className="text-3xl font-mono tracking-widest text-blue-800 font-bold">
                {otpDisplayInfo.otp || "Error"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(otpDisplayInfo.otp)}
                className="h-9 p-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                title="Copy OTP"
              >
                <Copy size={18} />
              </Button>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-3 text-center">
              Share this code with {otpDisplayInfo.userName} securely. It cannot be recovered after closing this window.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmation.isOpen} onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent className="bg-white rounded-lg max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-800">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              Confirm User Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 pt-2">
              Are you absolutely sure you want to delete the user
              <span className="font-semibold text-slate-800"> "{deleteConfirmation.userName}" </span>
              (ID: <span className="font-semibold text-slate-800">{deleteConfirmation.userId}</span>)?
              <br />
              <span className="font-medium text-red-700">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel
              onClick={() => setDeleteConfirmation({ isOpen: false, userId: null, userName: null })}
              className="hover:bg-slate-50"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={actionLoading[`delete_${deleteConfirmation.userId}`]}
            >
              {actionLoading[`delete_${deleteConfirmation.userId}`] ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                </>
               ) : (
                "Yes, Delete User"
               )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <footer className="bg-white border-t border-slate-200 text-slate-600 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center">
              <Image src={jmLogo} alt={companyName} width={32} height={32} className="rounded mr-2" data-ai-hint="logo" />
              <span className="font-semibold text-slate-800 text-sm">{companyName}</span>
            </div>

            <div className="flex items-center space-x-4 sm:space-x-6 text-xs sm:text-sm">
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-blue-700 hover:bg-transparent p-0 h-auto">
                Privacy Policy
              </Button>
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-blue-700 hover:bg-transparent p-0 h-auto">
                Terms of Service
              </Button>
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-blue-700 hover:bg-transparent p-0 h-auto">
                Contact Support
              </Button>
            </div>
          </div>

          <Separator className="my-4 bg-slate-100" />

          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
            <p className="text-xs sm:text-sm">© {typeof window !== 'undefined' ? new Date().getFullYear() : ''} {companyName}. All rights reserved.</p>
            <p className="text-xs sm:text-sm mt-2 md:mt-0">Upteky Solution Pvt. Ltd.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}


// Export a wrapper component that uses ProtectedRoute
export default function AdminDashboard() {
    return (
        <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboardContent />
        </ProtectedRoute>
    );
}






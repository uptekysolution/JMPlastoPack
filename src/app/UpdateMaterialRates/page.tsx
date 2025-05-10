
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateBOPPRate, getAllBOPPRates, recordRateHistory } from "@/lib/bopp_rates_actions"; // Added recordRateHistory
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, RefreshCw, Database, AlertCircle, Loader2, History } from "lucide-react"; // Added Loader2, History
import { Toaster } from "@/components/ui/toaster";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ProtectedRoute from '@/components/auth/ProtectedRoute'; // Import ProtectedRoute
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import type { RatesObject } from "@/lib/bopp_rates_actions"; // Import type

// Define types for rates and categories
type OriginalRatesObject = RatesObject; // Use the imported type
type Categories = {
  printTypes: string[];
  pasteTypes: string[];
  baseRates: string[];
  otherRates: string[];
};

// Define all expected keys upfront for better state management
const ALL_RATE_KEYS = [
    'SINGLE_COLOUR_PRINTED',
    'DOUBLE_COLOUR_PRINTED',
    'THREE_COLOUR_PRINTED',
    'FOUR_COLOUR_PRINTED',
    'FULL_PRINT',
    'NATURAL', // Added NATURAL
    'MILKY_WHITE',
    'BROWN_TAPE',
    'COLOR_TAPE',
    'TRANSPARENT',
    'PACKING_COST',
    'BOPP_FILM_RATE',
    'ADHESIVE_RATE',
    'COATING_EXP',
    'PROFIT',
    'ADHESIVE_LESS_RATE', // Ensure this is included for editing
];

const initialRatesState: RatesObject = ALL_RATE_KEYS.reduce((acc, key) => {
    acc[key] = ''; // Initialize all as empty strings
    return acc;
}, {} as RatesObject);

// Default values map (as strings) - Used ONLY if value is missing from DB
const DEFAULT_RATE_VALUES: Record<string, string> = {
    'COATING_EXP': '12',
    'PROFIT': '12',
    'FULL_PRINT': '10',
    'ADHESIVE_RATE': '11',
    'PACKING_COST': '220',
    'BOPP_FILM_RATE': '118',
    'SINGLE_COLOUR_PRINTED': '150',
    'DOUBLE_COLOUR_PRINTED': '225',
    'THREE_COLOUR_PRINTED': '300',
    'FOUR_COLOUR_PRINTED': '350',
    'MILKY_WHITE': '160',
    'BROWN_TAPE': '105',
    'COLOR_TAPE': '250',
    'TRANSPARENT': '0',
    'ADHESIVE_LESS_RATE': '0', // Default for adhesive less rate
    'NATURAL': '0', // Added NATURAL default
};


function UpdateMaterialRatesContent() { // Renamed component
  const { user } = useAuth(); // Get user from context
  const [rates, setRates] = useState<RatesObject>(initialRatesState);
  const [originalRates, setOriginalRates] = useState<OriginalRatesObject>(initialRatesState);
  const [loadingRates, setLoadingRates] = useState(true); // Renamed from 'loading'
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null); // Type added
  const [categories, setCategories] = useState<Categories>({
    printTypes: [],
    pasteTypes: [],
    baseRates: [],
    otherRates: [],
  });
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false); // State for retry loading
  const [isNavigatingToHistory, setIsNavigatingToHistory] = useState(false); // State for history navigation loading
  const [isNavigatingBack, setIsNavigatingBack] = useState(false); // State for navigating back loading


  const fetchRates = async () => {
      setLoadingRates(true); // Ensure loading state is true initially
      setError(null); // Reset error state
      try {
        const boppRates = await getAllBOPPRates(); // Fetches Record<string, number>
        console.log("Fetched DB Rates:", boppRates); // Log fetched rates

        // Start with the initial state structure (all keys with empty strings)
        const ratesObject: RatesObject = { ...initialRatesState };

        // Populate with fetched values, converting to string, only for keys we expect
        for (const key in boppRates) {
            if (Object.prototype.hasOwnProperty.call(boppRates, key) && ALL_RATE_KEYS.includes(key)) {
                 ratesObject[key] = String(boppRates[key]);
            } else if (!ALL_RATE_KEYS.includes(key)) {
                console.warn(`Ignoring unexpected rate key from DB: ${key}`);
            }
        }

        // Apply defaults ONLY if the key is still the initial empty string after fetching
        ALL_RATE_KEYS.forEach(key => {
            if (ratesObject[key] === '') {
                if (DEFAULT_RATE_VALUES[key] !== undefined) {
                    ratesObject[key] = DEFAULT_RATE_VALUES[key];
                    console.warn(`Key ${key} not found in DB or was empty, applying default: '${ratesObject[key]}'`);
                } else {
                    // If no specific default, fallback to '0'
                    ratesObject[key] = '0';
                    console.warn(`Key ${key} not found in DB or was empty, no specific default found, applying '0'`);
                }
            }
        });

        console.log("Processed Rates Object for State (strings):", ratesObject); // Log the final object going to state

        // --- Categorize Keys ---
        const printTypes: string[] = [];
        const pasteTypes: string[] = [];
        const baseRates: string[] = [];
        const otherRates: string[] = [];

        Object.keys(ratesObject).forEach(key => {
          // Ensure we only categorize keys that are expected
          if (!ALL_RATE_KEYS.includes(key)) return;

          if (['SINGLE_COLOUR_PRINTED', 'DOUBLE_COLOUR_PRINTED', 'THREE_COLOUR_PRINTED', 'FOUR_COLOUR_PRINTED', 'FULL_PRINT', 'NATURAL'].includes(key)) { // Added NATURAL
            printTypes.push(key);
          } else if (['MILKY_WHITE', 'BROWN_TAPE', 'COLOR_TAPE', 'TRANSPARENT'].includes(key)) {
            pasteTypes.push(key);
          } else if (['COATING_EXP', 'PROFIT', 'ADHESIVE_LESS_RATE'].includes(key)) { // ADHESIVE_LESS_RATE added to Other Rates
             otherRates.push(key);
          } else if (['PACKING_COST', 'BOPP_FILM_RATE', 'ADHESIVE_RATE'].includes(key)) {
            baseRates.push(key);
          } else {
             console.warn(`Uncategorized expected rate key found: ${key}. Adding to 'Other Rates'.`);
             otherRates.push(key);
          }
        });

        // Sort keys alphabetically within each category
        printTypes.sort();
        pasteTypes.sort();
        baseRates.sort();
        otherRates.sort();


        setCategories({
          printTypes,
          pasteTypes,
          baseRates,
          otherRates,
        });

        setRates(ratesObject); // Set state with processed rates (as strings)
        // Set originalRates AFTER processing defaults and fetching
        setOriginalRates(JSON.parse(JSON.stringify(ratesObject))); // Deep copy for change tracking
        setLoadingRates(false);
      } catch (e) {
        console.error("Failed to load rates:", e);
        setError("Failed to load material rates from the database.");
        setLoadingRates(false);
        toast({
          variant: "destructive",
          title: "Error Loading Data",
          description: "Failed to load material rates. Please try again later."
        });
      }
  };

  useEffect(() => {
    fetchRates();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { // Type event
    setRates(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isRateChanged = (key: string): boolean => { // Type added
    // Compare as strings since state stores them as strings
    const originalValue = originalRates[key]?.toString() ?? '';
    const currentValue = rates[key]?.toString() ?? '';
    // console.log(`Comparing ${key}: Original='${originalValue}', Current='${currentValue}', Changed=${originalValue !== currentValue}`);
    return originalValue !== currentValue;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => { // Type event
    e.preventDefault();
    setSaving(true);
    let historyRecordedSuccessfully = false; // Track history recording status
    let updateErrorsOccurred = false; // Track if any update failed

    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "Cannot save changes. User not logged in.",
      });
      setSaving(false);
      return;
    }

    try {
      const changedRatesKeys = Object.keys(rates).filter(key => isRateChanged(key) && ALL_RATE_KEYS.includes(key));
      console.log("Changed rate keys:", changedRatesKeys);

      if (changedRatesKeys.length === 0) {
        toast({
          title: "No Changes",
          description: "No rates were modified.",
        });
        setSaving(false);
        return;
      }

      let successCount = 0;
      const updatePromises: Promise<any>[] = [];
      let validationFailed = false; // Flag for validation errors

      // --- Step 1: Validate and Prepare updates ---
      for (const key of changedRatesKeys) {
        const stringValue = rates[key].toString();
        const numericValue = parseFloat(stringValue);

        console.log(`Processing change for ${key}: Value='${stringValue}', Parsed='${numericValue}'`);

        if (isNaN(numericValue) || numericValue < 0) {
          toast({
            variant: "destructive",
            title: "Invalid Input",
            description: `Invalid or negative value entered for ${key}: ${stringValue}. Please enter a non-negative number.`,
          });
          validationFailed = true;
          break; // Stop processing further updates if validation fails
        }
        // Push the update promise to the array
        updatePromises.push(updateBOPPRate(key, numericValue, user));
      }

      // --- Step 2: Execute updates (only if validation passed) ---
      if (!validationFailed && updatePromises.length > 0) {
        console.log("Executing DB updates...");
        const results = await Promise.allSettled(updatePromises);
        results.forEach((result, index) => {
          const key = changedRatesKeys[index];
          if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
            console.log(`Update successful for ${key}`);
          } else {
            updateErrorsOccurred = true; // Mark that at least one update failed
            let errorMessage = `Failed to update rate for ${key}.`;
            if (result.status === 'rejected') {
              errorMessage = (result.reason as Error).message || `Failed to update rate for ${key} (rejected promise).`;
              console.error(`Update failed for ${key} (Rejected):`, result.reason);
            } else { // Fulfilled but result.value.success is false or undefined
              errorMessage = result.value?.message || `Failed to update rate for ${key} (backend error).`;
               // Improved error logging
               console.error(`Update failed for ${key} (Fulfilled with error): Type=${typeof result.value}, Value=${JSON.stringify(result.value)}`);
            }
            toast({
              variant: "destructive",
              title: "Update Failed",
              description: errorMessage,
            });
          }
        });
        console.log(`DB update execution finished. Success count: ${successCount}, Errors Occurred: ${updateErrorsOccurred}`);
      }

      // --- Step 3: Record history only if validation passed AND at least one update succeeded ---
      if (!validationFailed && successCount > 0) {
        console.log("Recording rate history...");
        const historyResult = await recordRateHistory(user);

        if (historyResult.success) {
          historyRecordedSuccessfully = true;
          console.log("History recorded successfully.");
          toast({
            title: "Success",
            description: `Successfully updated ${successCount} rate(s) and recorded history.`,
            variant: "default",
          });
        } else {
          console.error("History recording failed:", historyResult.message);
          toast({
            variant: "destructive",
            title: "History Recording Failed",
            description: historyResult.message || "Rates were updated, but failed to record the change history.",
          });
        }
      } else if (validationFailed) {
        console.error("Validation failed. No updates attempted or history recorded.");
      } else if (successCount === 0 && changedRatesKeys.length > 0) {
        // This case means all attempted updates failed
        console.error("All rate updates failed. History not recorded.");
      }


    } catch (err: any) { // Type error
      console.error("Error updating rates:", err);
      updateErrorsOccurred = true; // Ensure flag is set on general error
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.message || "There was an error updating the material rates. Please try again.",
      });
    } finally {
      // --- Step 4: Refetch data regardless of success/failure to sync UI with DB ---
      // This ensures the UI reflects the actual state, even if some updates failed.
      console.log("Refetching rates after save attempt...");
      await fetchRates(); // This will update both `rates` and `originalRates` based on DB
      setSaving(false); // Stop saving indicator AFTER refetching
    }
  };

  const handleReset = () => {
    setRates(JSON.parse(JSON.stringify(originalRates))); // Deep copy
    toast({
      title: "Reset Complete",
      description: "All changes have been discarded.",
    });
  };

  const handleReturnToCalculator = () => {
     setIsNavigatingBack(true); // Start loading
     router.push("/bopp-calculator?role=admin"); // Always go back as admin from this page
     // Loading state will naturally reset on page change
  };

  const handleShowHistory = () => { // Renamed function
    setIsNavigatingToHistory(true); // Start loading
    router.push("/rate-history"); // Navigate to the new history page
    // Loading state will naturally reset on page change
  };

  const handleRetry = async () => {
      setIsRetrying(true);
      await fetchRates(); // Simply re-run the fetch function
      setIsRetrying(false); // Ensure this is set after fetch completes or fails
  };


  if (loadingRates) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600 animate-spin" />
          <p className="text-base sm:text-lg text-slate-700">Loading material rates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
        <Toaster />
        <Card className="w-full max-w-md border-red-200 shadow-lg">
          <CardHeader className="bg-red-50 border-b border-red-100 p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl text-red-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Loading Data
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
            <p className="text-slate-700 text-sm sm:text-base">{error}</p>
          </CardContent>
          <CardFooter className="pt-2 flex justify-end p-4 sm:p-6">
            <Button onClick={handleRetry} className="bg-red-600 hover:bg-red-700 text-white text-sm sm:text-base" disabled={isRetrying}>
               {isRetrying ? (
                 <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   Retrying...
                 </>
               ) : (
                 "Retry"
               )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const renderRateInputs = (categoryKeys: string[]) => { // Type added
    // Filter out keys that shouldn't be displayed or handled elsewhere if necessary
    const displayKeys = categoryKeys.filter(key => key !== undefined && rates[key] !== undefined);

    if (displayKeys.length === 0) {
        return <p className="text-slate-500 text-sm col-span-full">No rates available for this category.</p>;
    }

    return displayKeys.map((key) => (
      <div className="grid gap-2" key={key}>
        <div className="flex justify-between items-center">
          <Label htmlFor={key} className="text-slate-700 font-medium text-sm sm:text-base">
            {key.replace(/_/g, ' ')} {key === 'PROFIT' ? '(%)' : ''}
          </Label>
          {isRateChanged(key) && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
              Modified
            </Badge>
          )}
        </div>
        <Input
          type="number"
          id={key}
          name={key}
          value={rates[key]?.toString() ?? ''} // Ensure value is string or empty
          onChange={handleChange}
          placeholder={key.replace(/_/g, ' ')}
          className={`border-slate-200 focus:border-blue-300 text-sm sm:text-base ${
            isRateChanged(key) ? 'border-amber-300 bg-amber-50' : ''
          }`}
          step={key === 'PROFIT' ? "0.1" : "0.01"} // Step 0.01 for most rates
           required
           min="0" // HTML5 attribute to prevent negative input in browser
        />
      </div>
    ));
  };

  const changedCount = Object.keys(rates).filter(key => isRateChanged(key) && ALL_RATE_KEYS.includes(key)).length; // Count only expected keys
  const clientCurrentYear = typeof window !== 'undefined' ? new Date().getFullYear() : '';


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 sm:py-12 px-4">
       <Toaster />
      <div className="w-full max-w-6xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-2 sm:gap-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Material Rate Management</h1>
            <p className="text-slate-500 mt-1 text-sm sm:text-base">J M PlastoPack Pvt. Ltd.</p>
          </div>
          <Badge variant="outline" className="px-3 py-1 bg-blue-50 text-blue-700 border-blue-200 text-xs sm:text-sm self-start sm:self-center">
            {changedCount > 0 ? `${changedCount} Pending Changes` : "No Changes"}
          </Badge>
        </div>

        <Card className="shadow-lg border-slate-200 mb-6">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
              <div>
                <CardTitle className="text-xl sm:text-2xl text-slate-800">BOPP Material Rates</CardTitle>
                <CardDescription className="text-slate-500 text-sm sm:text-base mt-1">
                  Update manufacturing cost parameters for rate calculations
                </CardDescription>
              </div>
              <Database className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 mt-2 sm:mt-0" />
            </div>
          </CardHeader>

          <CardContent className="pt-6 p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {categories.printTypes.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3 sm:mb-4">Print Type Rates</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderRateInputs(categories.printTypes)}
                    </div>
                    <Separator className="my-4 sm:my-6" />
                </div>
              )}

              {categories.pasteTypes.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3 sm:mb-4">Paste Type Rates</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderRateInputs(categories.pasteTypes)}
                    </div>
                    <Separator className="my-4 sm:my-6" />
                </div>
              )}

              {categories.baseRates.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3 sm:mb-4">Base Material Rates</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderRateInputs(categories.baseRates)}
                    </div>
                    <Separator className="my-4 sm:my-6" />
                </div>
              )}

              {categories.otherRates.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3 sm:mb-4">Additional Parameters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderRateInputs(categories.otherRates)}
                    </div>
                </div>
               )}

              {changedCount > 0 && (
                <div className="mt-6 sm:mt-8 bg-slate-50 border border-slate-200 rounded-md p-3 sm:p-4">
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Summary of Changes</h3>
                   <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead className="font-medium text-slate-700 text-xs sm:text-sm whitespace-nowrap">Parameter</TableHead>
                                <TableHead className="font-medium text-slate-700 text-xs sm:text-sm whitespace-nowrap">Original Value</TableHead>
                                <TableHead className="font-medium text-slate-700 text-xs sm:text-sm whitespace-nowrap">New Value</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody className="text-xs sm:text-sm">
                            {Object.keys(rates)
                                .filter(key => isRateChanged(key) && ALL_RATE_KEYS.includes(key)) // Show only expected keys
                                .map(key => (
                                <TableRow key={`summary-${key}`}>
                                    <TableCell className="font-medium whitespace-nowrap">{key.replace(/_/g, ' ')}</TableCell>
                                    <TableCell className="whitespace-nowrap">{originalRates[key]}</TableCell>
                                    <TableCell className="text-blue-700 whitespace-nowrap">{rates[key]}</TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                   </div>
                </div>
              )}

              <div className="pt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center sm:justify-between gap-3 sm:gap-4">
                 <Button
                    type="button"
                    variant="outline"
                    onClick={handleShowHistory} // Use the renamed function
                    className="w-full sm:w-auto border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 text-sm sm:text-base py-2 px-4"
                    disabled={isNavigatingToHistory} // Disable while navigating
                 >
                    {isNavigatingToHistory ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading History...
                        </>
                      ) : (
                         <>
                            <History className="h-4 w-4" /> {/* History Icon */}
                             View Rate History
                         </>
                      )}
                 </Button>

                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReturnToCalculator}
                    className="w-full sm:w-auto border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 text-sm sm:text-base py-2 px-4"
                    disabled={isNavigatingBack} // Disable while navigating back
                  >
                   {isNavigatingBack ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                             Navigating...
                        </>
                    ) : (
                        <>
                             <ArrowLeft className="h-4 w-4" /> Back to Calculator
                        </>
                    )}
                  </Button>

                  {changedCount > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleReset}
                      className="w-full sm:w-auto border-slate-200 text-slate-700 hover:bg-slate-50 text-sm sm:text-base py-2 px-4"
                    >
                      Reset Changes
                    </Button>
                  )}

                  <Button
                    type="submit"
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 text-sm sm:text-base py-2 px-4"
                    disabled={saving || changedCount === 0}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Material Rates
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-slate-500 text-xs sm:text-sm">
           <p>©Copyright {clientCurrentYear} J M PlastoPack Pvt. Ltd. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

// Export a wrapper component that uses ProtectedRoute
export default function UpdateMaterialRates() {
    return (
        <ProtectedRoute allowedRoles={['admin']}>
            <UpdateMaterialRatesContent />
        </ProtectedRoute>
    );
}

    

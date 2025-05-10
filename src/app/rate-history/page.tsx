'use client';

import React, { useState, useEffect } from 'react';
import {
  getRateHistory,
  type RateHistoryEntry,
  type RatesObject,
} from '@/lib/bopp_rates_actions';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, AlertCircle, Loader2, History, User, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Badge } from '@/components/ui/badge';

const DISPLAY_LIMIT = 3; // Number of history entries to display

function RateHistoryContent() {
  const [history, setHistory] = useState<RateHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const router = useRouter();

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    setIsRetrying(false);
    try {
      // Fetch one more than display limit for comparison purposes
      const historyData = await getRateHistory(DISPLAY_LIMIT + 1); 
      if (!historyData) {
        throw new Error('No history data returned.');
      }
      setHistory(historyData);
      setLoading(false);
    } catch (e) {
      console.error('Failed to load rate history:', e);
      setError('Failed to load rate history. Please try refreshing.');
      setLoading(false);
      toast({
        variant: 'destructive',
        title: 'Error Loading History',
        description: 'Could not fetch rate history from the database.',
      });
    }
  };

  useEffect(() => {
    fetchHistory();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoBack = () => {
    router.back(); // Go back to the previous page (UpdateMaterialRates)
  };

  const handleRetry = () => {
    setIsRetrying(true);
    fetchHistory();
  };

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
       if (isNaN(date.getTime())) return "Invalid Date"; // Check for invalid date
       // Format: DD-Mon-YYYY HH:MM:SS (e.g., 01-Aug-2024 14:30:55)
       const options: Intl.DateTimeFormatOptions = {
         day: '2-digit',
         month: 'short',
         year: 'numeric',
         hour: '2-digit',
         minute: '2-digit',
         second: '2-digit',
         hour12: false, // Use 24-hour format
       };
       // Replace commas potentially added by some locales
       return date.toLocaleString('en-GB', options).replace(/,/g, '');
    } catch (e) {
      console.error("Error formatting date:", e);
      return "Invalid Date";
    }
  };

  // Function to compare two rate snapshots and identify changes
  const getChangedKeys = (current: RatesObject, previous: RatesObject | undefined): Set<string> => {
    if (!previous) {
      // If no previous snapshot, consider all keys as "changed" (initial state)
      return new Set(Object.keys(current));
    }
    const changed = new Set<string>();
    const allKeys = new Set([...Object.keys(current), ...Object.keys(previous)]);
    allKeys.forEach(key => {
      if (current[key]?.toString() !== previous[key]?.toString()) { // Compare as strings
        changed.add(key);
      }
    });
    return changed;
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-12 w-12 text-blue-600 animate-spin" />
          <p className="text-lg text-slate-700">Loading rate history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        <Toaster />
        <Card className="w-full max-w-md border-red-200 shadow-lg mx-4">
          <CardHeader className="bg-red-50 border-b border-red-100 p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl text-red-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Loading Data
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
            <p className="text-slate-700 text-sm sm:text-base">{error}</p>
          </CardContent>
          <CardFooter className="pt-2 flex flex-col sm:flex-row justify-between gap-2 p-4 sm:p-6">
            <Button
              variant="outline"
              onClick={handleGoBack}
              className="w-full sm:w-auto border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 py-2 px-3 sm:px-4 text-sm sm:text-base"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={handleRetry} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white py-2 px-3 sm:px-4 text-sm sm:text-base" disabled={isRetrying}>
              {isRetrying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                'Retry'
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  const itemsToDisplay = history.slice(0, DISPLAY_LIMIT);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 sm:py-12 px-4">
      <Toaster />
      <div className="w-full max-w-5xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-3 sm:gap-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <History className="h-6 w-6 sm:h-7 sm:w-7" /> Rate History
          </h1>
          <Button
            variant="outline"
            onClick={handleGoBack}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 py-2 px-3 sm:px-4 text-sm sm:text-base self-start sm:self-center"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Rate Management
          </Button>
        </div>

        {itemsToDisplay.length === 0 ? (
          <Card className="shadow-lg border-slate-200">
             <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">No History Found</CardTitle>
             </CardHeader>
             <CardContent className="p-4 sm:p-6 pt-0">
                <p className="text-slate-600 text-sm sm:text-base">There are no recorded changes in the material rates yet.</p>
             </CardContent>
          </Card>
        ) : (
          <Accordion 
            type="single" 
            collapsible 
            className="w-full space-y-4" 
            defaultValue={itemsToDisplay.length > 0 ? `item-${itemsToDisplay[0].id}` : undefined}
          >
            {itemsToDisplay.map((entry, displayIndex) => {
              // The actual previous entry is at displayIndex + 1 in the full 'history' array
              const previousEntry = history[displayIndex + 1]; 
              const changedKeys = getChangedKeys(entry.rates_snapshot, previousEntry?.rates_snapshot);
              const sortedKeys = Object.keys(entry.rates_snapshot).sort();

              return (
                <AccordionItem value={`item-${entry.id}`} key={entry.id} className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 sm:px-6 sm:py-4 hover:bg-slate-50 transition-colors data-[state=open]:bg-slate-50 data-[state=open]:border-b border-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-2 sm:gap-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600">
                            <Clock className="h-4 w-4"/>
                            <span>{formatDateTime(entry.changed_at)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600">
                             <User className="h-4 w-4"/>
                            <span>{entry.changed_by_name} ({entry.changed_by_id})</span>
                          </div>
                      </div>
                       <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs sm:text-sm self-start sm:self-auto mt-1 sm:mt-0">
                          {changedKeys.size} Change{changedKeys.size !== 1 ? 's' : ''}
                       </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pt-0 pb-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-100">
                          <TableRow>
                            <TableHead className="font-semibold text-slate-800 pl-4 sm:pl-6 py-2 sm:py-3 text-xs sm:text-sm">Parameter Key</TableHead>
                            <TableHead className="font-semibold text-slate-800 text-right pr-4 sm:pr-6 py-2 sm:py-3 text-xs sm:text-sm">Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedKeys.map((key) => {
                            const isChanged = changedKeys.has(key);
                            const previousValue = previousEntry?.rates_snapshot[key];
                            const currentValue = entry.rates_snapshot[key];

                            return (
                              <TableRow key={key} className={`hover:bg-slate-50/50 ${isChanged ? 'bg-amber-50' : ''}`}>
                                <TableCell className={`font-medium pl-4 sm:pl-6 py-2 sm:py-3 text-xs sm:text-sm ${isChanged ? 'text-amber-800' : 'text-slate-700'}`}>
                                  {key.replace(/_/g, ' ')}
                                   {isChanged && previousEntry && (
                                     <span className="ml-2 text-xs text-slate-500">(was {previousValue ?? 'N/A'})</span>
                                   )}
                                </TableCell>
                                <TableCell className={`text-right pr-4 sm:pr-6 py-2 sm:py-3 text-xs sm:text-sm ${isChanged ? 'text-amber-800 font-semibold' : ''}`}>
                                  {currentValue}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        <div className="mt-8 text-center text-slate-500 text-xs sm:text-sm">
          <p>© {typeof window !== 'undefined' ? new Date().getFullYear() : ''} J M PlastoPack Pvt. Ltd. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

// Export a wrapper component that uses ProtectedRoute
export default function RateHistory() {
  return (
    // Allow only admins to view the rate history
    <ProtectedRoute allowedRoles={['admin']}>
      <RateHistoryContent />
    </ProtectedRoute>
  );
}


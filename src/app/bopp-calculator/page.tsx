
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; // Combined imports
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllBOPPRates } from "@/lib/bopp_rates_actions";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calculator, Settings, BarChart3, ArrowRight, Loader2, RefreshCw, AlertCircle, Printer, ArrowLeft } from "lucide-react"; // Added Printer icon and ArrowLeft
import ProtectedRoute from '@/components/auth/ProtectedRoute'; // Import ProtectedRoute
import { useAuth } from '@/context/AuthContext'; // Import useAuth to check role
import { Toaster } from '@/components/ui/toaster'; // Import Toaster


function BoppCalculatorContent() { // Renamed component
  const [inputs, setInputs] = useState({
    bopp_film: '',
    adhesive: '',
    bopp_tape_mtrs: '',
    printed: '',
    paste: '',
    R36: '1000',
    // ADHESIVE_LESS_RATE is no longer an input here, it will be fetched from dbRates
  });

  const [printedOptions, setPrintedOptions] = useState([
    'SINGLE_COLOUR_PRINTED',
    'DOUBLE_COLOUR_PRINTED',
    'THREE_COLOUR_PRINTED',
    'FOUR_COLOUR_PRINTED',
    'FULL_PRINT',
    'NATURAL',
  ]);

  const [pasteOptions, setPasteOptions] = useState([
    'MILKY_WHITE',
    'BROWN_TAPE',
    'COLOR_TAPE',
    'TRANSPARENT',
    // 'FULL_PRINT' // Removed from here
  ]);

  const [dbRates, setDbRates] = useState<Record<string, number> | null>(null); // Type added
  const [output, setOutput] = useState<Record<string, number | null> | null>(null); // Type added
  const [calculationError, setCalculationError] = useState<string | null>(null); // Type added
  const [activeTab, setActiveTab] = useState("input");
  const [isCalculating, setIsCalculating] = useState(false); // State for calculation loading
  const [loadingRates, setLoadingRates] = useState(true); // State for initial rates loading
  const [errorLoadingRates, setErrorLoadingRates] = useState<string | null>(null); // State for rate loading errors
  const [isRetryingRates, setIsRetryingRates] = useState(false); // State for retry loading
  const [isNavigatingToRates, setIsNavigatingToRates] = useState(false); // State for navigating to rates page loading
  const [isGeneratingRateCard, setIsGeneratingRateCard] = useState(false); // State for rate card navigation
  const [isNavigatingToDashboard, setIsNavigatingToDashboard] = useState(false); // State for navigating to dashboard

  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth(); // Get user from context
  const isAdmin = user?.role === 'admin'; // Determine admin status from context

  const fetchRates = async () => {
    setErrorLoadingRates(null);
    setIsRetryingRates(false);
    setLoadingRates(true); // Set loading true at the start
    try {
      const ratesObject = await getAllBOPPRates(); // getAllBOPPRates already returns Record<string, number>
      if (!ratesObject || Object.keys(ratesObject).length === 0) { // Check if object is empty
        throw new Error("No rates returned from the database.");
      }
      setDbRates(ratesObject);
      console.log("Fetched BOPP Rates:", ratesObject);
    } catch (error) {
      console.error("Failed to fetch BOPP rates:", error);
      setErrorLoadingRates("Failed to fetch initial BOPP rates. Calculations might be inaccurate. Please try refreshing.");
      toast({
        variant: "destructive",
        title: "Error Loading Rates",
        description: "Failed to fetch BOPP rates. Please try again later.",
      });
    } finally {
       setLoadingRates(false); // Set loading false here to ensure it's always set
    }
  };

  useEffect(() => {
    fetchRates();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { // Type event
    setInputs(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

   // Type for Select change
  const handleSelectChange = (name: string) => (value: string) => {
    setInputs(prev => ({ ...prev, [name]: value }));
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => { // Type event
    e.preventDefault();
    setCalculationError(null);
    setIsCalculating(true); // Start loading

    if (!dbRates) {
      setCalculationError("Database rates not loaded. Calculation cannot proceed.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Database rates not loaded. Cannot calculate. Please try refreshing the page.",
      });
      setIsCalculating(false); // Stop loading
      return;
    }

    try {
      const parsedInputs = {
        ...inputs,
        bopp_film: parseFloat(inputs.bopp_film) || 0,
        adhesive: parseFloat(inputs.adhesive) || 0,
        bopp_tape_mtrs: parseFloat(inputs.bopp_tape_mtrs) || 0,
        R36: parseFloat(inputs.R36) || 1000,
        printed: inputs.printed,
        paste: inputs.paste,
      };

      // Ensure all required rates are loaded before calculating
      const requiredRateKeys = [
        parsedInputs.printed,
        parsedInputs.paste,
        'ADHESIVE_RATE',
        'BOPP_FILM_RATE',
        'PACKING_COST',
        'COATING_EXP',
        'PROFIT',
        'ADHESIVE_LESS_RATE', // This is now expected to be in dbRates
      ];
       const missingDbRates = requiredRateKeys.filter(key => key && dbRates[key] === undefined);

       if (missingDbRates.length > 0) {
          throw new Error(`Missing required rates from database: ${missingDbRates.join(', ')}.`);
       }


      const calculateOutputs = (inputs: Omit<typeof parsedInputs, 'adhesive_less_rate'>, dbRates: Record<string, number>): Record<string, number | null> | { error: string } => { // Type added
        const {
          bopp_film,
          adhesive,
          bopp_tape_mtrs,
          printed,
          paste,
          R36,
        } = inputs;

        // Fetch rates from the dbRates object, providing default values or handling missing keys
        const BOPP_FILM_RATE_PRINTED = dbRates[printed];
        const PASTE_RATE = dbRates[paste];
        const ADHESIVE_RATE = dbRates.ADHESIVE_RATE;
        const RAW_BOPP_RATE = dbRates.BOPP_FILM_RATE;
        const PACKING_COST = dbRates.PACKING_COST;
        const COATING_EXP = dbRates.COATING_EXP;
        const PROFIT_PERCENTAGE = dbRates.PROFIT !== undefined ? dbRates.PROFIT / 100 : 0; // Use 0 if PROFIT is undefined
        const ADHESIVE_LESS_RATE = dbRates.ADHESIVE_LESS_RATE; // Fetched from DB

        if (
          bopp_film === undefined || bopp_film <= 0 ||
          adhesive === undefined || adhesive <= 0 ||
          bopp_tape_mtrs === undefined || bopp_tape_mtrs <= 0 ||
          R36 === undefined || R36 <= 0 ||
          printed === undefined || printed === '' ||
          paste === undefined || paste === '' ||
          BOPP_FILM_RATE_PRINTED === undefined ||
          PASTE_RATE === undefined ||
          ADHESIVE_RATE === undefined ||
          RAW_BOPP_RATE === undefined ||
          PACKING_COST === undefined ||
          COATING_EXP === undefined ||
          dbRates.PROFIT === undefined || // Check original PROFIT from DB
          ADHESIVE_LESS_RATE === undefined || ADHESIVE_LESS_RATE < 0
        ) {
           const missing = [];
           if (!bopp_film || bopp_film <= 0) missing.push("BOPP Film Thickness (must be > 0)");
           if (!adhesive || adhesive <= 0) missing.push("Adhesive Thickness (must be > 0)");
           if (!bopp_tape_mtrs || bopp_tape_mtrs <= 0) missing.push("Tape Length (must be > 0)");
           if (!R36 || R36 <= 0) missing.push("R36 Meters (must be > 0)");
           if (!printed) missing.push("Print Type");
           if (!paste) missing.push("Paste Type");
           // Check DB Rates
           if (ADHESIVE_RATE === undefined) missing.push("DB Rate: ADHESIVE_RATE");
           if (RAW_BOPP_RATE === undefined) missing.push("DB Rate: BOPP_FILM_RATE");
           if (PACKING_COST === undefined) missing.push("DB Rate: PACKING_COST");
           if (COATING_EXP === undefined) missing.push("DB Rate: COATING_EXP");
           if (dbRates.PROFIT === undefined) missing.push("DB Rate: PROFIT");
           if (ADHESIVE_LESS_RATE === undefined || ADHESIVE_LESS_RATE < 0) missing.push("DB Rate: ADHESIVE_LESS_RATE (must be >= 0)");
           if (printed && BOPP_FILM_RATE_PRINTED === undefined) missing.push(`DB Rate for Print Type: ${printed}`);
           if (paste && PASTE_RATE === undefined) missing.push(`DB Rate for Paste Type: ${paste}`);

           console.error("Missing/Invalid Inputs or DB Rates:", missing);
           return { error: `Missing or invalid inputs/rates: ${missing.join(', ')}.` };
        }

        // const y = adhesive + 1;
        // const x = bopp_film + y;
        // const bopp_film_wt = 0.20925 * bopp_film;
        // const adhesive_wt = (((x * 0.94 * 225) / 1000) - bopp_film_wt) / 53.5 * 100;
        // const paste_wt = adhesive_wt * 0.06;

        const y = adhesive + 1;
        const x = bopp_film + y;
        const bopp_film_wt = 0.20925 * bopp_film;
        const adhesive_wt = (((x * 0.94 * 225) / 1000) - bopp_film_wt) / 53.5 * 100;
        const paste_wt = adhesive_wt * 0.06;


        const R2 = (((((bopp_film_wt * RAW_BOPP_RATE) + (adhesive_wt * ADHESIVE_RATE) + BOPP_FILM_RATE_PRINTED + COATING_EXP - (adhesive_wt * 0.06 * ADHESIVE_LESS_RATE) + (paste_wt * PASTE_RATE)) / 65) * bopp_tape_mtrs + PACKING_COST) / 72) * (1 + PROFIT_PERCENTAGE) * 72 + 20;
        const R45 = (((((bopp_film_wt * RAW_BOPP_RATE) + (adhesive_wt * ADHESIVE_RATE) + BOPP_FILM_RATE_PRINTED + COATING_EXP - (adhesive_wt * 0.06 * ADHESIVE_LESS_RATE) + (paste_wt * PASTE_RATE)) / 65) * 65 + PACKING_COST) / 72) * (1 + PROFIT_PERCENTAGE) * 72 + 20;

        const R1 = x - 1;
        const R3 = 1315;
        const R4 = (((bopp_film_wt * RAW_BOPP_RATE) + (adhesive_wt * ADHESIVE_RATE) + BOPP_FILM_RATE_PRINTED + COATING_EXP - (adhesive_wt * 0.06 * ADHESIVE_LESS_RATE) + (paste_wt * PASTE_RATE)) / ((adhesive_wt * 0.54) + bopp_film_wt)) * 1.05;
        const R5 = null;
        const R6 = R4 + 5;

        const R7 = x * 4.873;
        const R8 = R7 / 1315 * 1610;
        const R9 = x * 0.2668;
        const R10 = null;

        const R11 = (x * 0.00027115 * bopp_tape_mtrs) + (bopp_tape_mtrs / 6500) + 0.16;
        const R12 = R11 * 12 + 0.75;
        const R13 = (R7 * R4) / 5260;
        const R14 = R11 / 6;

        const R16 = R2 / 144;
        const R15 = R16 / 2;
        const R17 = R2 / 96;
        const R18 = R2 / 72;
        const R20 = R18 * 1.5;
        const R19 = R2 / 72 / 48 * 60;
        const R21 = R18 * 2;

        const R35 = bopp_tape_mtrs;
        const R34 = 72;
        const R38 = -2.38;

        const R37 = R36 / 65;
        const R39 = R37 + R38;
        const R40 = 20 / 10.5;


        const R46 = R45 / R34 / 65 * R36;
        const R47 = R39 - R40;
        const R48 = R46 - R47;

        const R22 = R48 * 3;
        const R23 = R48;
        const R27 = R48 * 0.375;
        const R25 = R27 * 2;
        const R24 = R23 * 1.5;
        const R28 = R48 / 48 * 20;
        const R26 = R28 * 3;
        const R49 = R48 * 3;

        const R29 = null; const R30 = null; const R31 = null; const R32 = null;
        const R33 = null;
        const R41 = null; const R42 = null; const R43 = null; const R44 = null;


        return {
          R1,R2, R3, R4, R5, R6, R7, R8, R9, R10,
          R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R21, R22,
          R23, R24, R25, R26, R27, R28, R29, R30, R31, R32, R33, R34, R35, R36, R37, R38, R39, R40,
          R41, R42, R43, R44, R45, R46, R47, R48, R49,
          bopp_tape_mtrs
        };
      };


      const calculation = calculateOutputs(parsedInputs, dbRates);
      if ('error' in calculation) {
        setCalculationError(calculation.error);
        toast({
          variant: "destructive",
          title: "Calculation Error",
          description: calculation.error,
        });
        setOutput(null);
      } else {
        setOutput(calculation);
        setCalculationError(null);
        setActiveTab("results");
      }
    } catch (err: any) {
      console.error('Calculation failed:', err);
      const errorMessage = err.message || "An unexpected error occurred during calculation.";
      setCalculationError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
      setOutput(null);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleNavigateToRates = () => {
     setIsNavigatingToRates(true);
     router.push('/UpdateMaterialRates');
  };

  const handleRetryRates = () => {
    setIsRetryingRates(true);
    setLoadingRates(true); // Also set loadingRates true here
    fetchRates();
  };

  const handleGenerateRateCard = () => {
    if (!output) return;
    setIsGeneratingRateCard(true);

    const rateCardData = Object.entries(output).reduce((acc, [key, value]) => {
       if (['R1', 'bopp_tape_mtrs', 'R15', 'R16', 'R17', 'R18', 'R20', 'R19', 'R21', 'R36'].includes(key)) {
           acc[key] = formatValue(value);
       }
       return acc;
    }, {} as Record<string, string>);


    const queryParams = new URLSearchParams(rateCardData).toString();
    router.push(`/rate-card?${queryParams}`);
  };

  const formatValue = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return "-";
    return Number.isFinite(value) ? value.toFixed(2) : String(value);
  };

  const handleNavigateToDashboard = () => {
    setIsNavigatingToDashboard(true);
    if (user?.role) {
        router.push(`/${user.role}/dashboard`);
    } else {
        toast({
            variant: "destructive",
            title: "Navigation Error",
            description: "Cannot determine user role for navigation.",
        });
        setIsNavigatingToDashboard(false);
    }
};


   // Error State for Initial Rates
  if (loadingRates && !dbRates) { // Show only if rates are actually missing and we are in loading state
    return (
        <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
            <Toaster />
            <div className="flex flex-col items-center space-y-4">
              <RefreshCw className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600 animate-spin" />
              <p className="text-base sm:text-lg text-slate-700">Loading initial rates...</p>
            </div>
        </div>
    );
  }
  if (errorLoadingRates && !dbRates) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
        <Toaster />
        <Card className="w-full max-w-md border-red-200 shadow-lg">
          <CardHeader className="bg-red-50 border-b border-red-100 p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl text-red-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Loading Rates
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
            <p className="text-slate-700 text-sm sm:text-base">{errorLoadingRates}</p>
            <p className="text-xs text-slate-500 mt-2">Calculations may not work correctly. Try refreshing the page or contacting support.</p>
          </CardContent>
          <CardFooter className="pt-2 flex justify-end p-4 sm:p-6">
            <Button onClick={handleRetryRates} className="bg-red-600 hover:bg-red-700 text-white text-sm sm:text-base" disabled={isRetryingRates || loadingRates}>
              {(isRetryingRates || loadingRates) ? (
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


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 sm:py-12 px-4">
      <Toaster />
      <div className="w-full max-w-6xl">
        <div className="flex flex-wrap items-center justify-between mb-6 sm:mb-8 gap-4">
          <div className="flex items-center gap-2">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">BOPP Tape Calculator</h1>
                <p className="text-slate-500 mt-1 text-sm sm:text-base">J M PlastoPack Pvt. Ltd.</p>
            </div>
          </div>
          <Badge variant="outline" className="px-3 py-1 bg-blue-50 text-blue-700 border-blue-200 text-xs sm:text-sm self-start sm:self-center">
            Ready
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} mb-6 w-full sm:w-auto rounded-lg bg-slate-100 p-1`}>
            <TabsTrigger value="input" className="flex items-center gap-2 text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm rounded-md">
              <Calculator className="h-4 w-4" />
              Calculator
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2 text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm rounded-md" disabled={!output}>
              <BarChart3 className="h-4 w-4" />
              Results
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="rates" className="flex items-center gap-2 text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm rounded-md">
                <Settings className="h-4 w-4" />
                Material Rates
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="input">
            <Card className="shadow-lg border-slate-200 rounded-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100 p-4 sm:p-6 rounded-t-lg">
                <CardTitle className="text-xl sm:text-2xl text-slate-800">Input Parameters</CardTitle>
                <CardDescription className="text-slate-500 text-sm sm:text-base mt-1">
                  Enter material specifications to calculate BOPP tape rates
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 p-4 sm:p-6">
                <form onSubmit={handleSubmit} className="grid gap-4 sm:gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-1.5">
                      <Label htmlFor="bopp_film" className="text-slate-700 font-medium text-sm sm:text-base">
                        BOPP Film Thickness (µm)
                      </Label>
                      <Input
                        name="bopp_film"
                        type="number"
                        placeholder="Enter thickness"
                        value={inputs.bopp_film}
                        onChange={handleChange}
                        className="border-slate-200 focus:border-blue-300 text-sm sm:text-base h-10"
                        required
                        min="1"
                        step="0.1"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="adhesive" className="text-slate-700 font-medium text-sm sm:text-base">
                        Adhesive Thickness (µm)
                      </Label>
                      <Input
                        name="adhesive"
                        type="number"
                        placeholder="Enter thickness"
                        value={inputs.adhesive}
                        onChange={handleChange}
                        className="border-slate-200 focus:border-blue-300 text-sm sm:text-base h-10"
                        required
                        min="1"
                        step="0.1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-1.5">
                      <Label htmlFor="bopp_tape_mtrs" className="text-slate-700 font-medium text-sm sm:text-base">
                        BOPP Tape Length (meters)
                      </Label>
                      <Input
                        name="bopp_tape_mtrs"
                        type="number"
                        placeholder="Enter length"
                        value={inputs.bopp_tape_mtrs}
                        onChange={handleChange}
                        className="border-slate-200 focus:border-blue-300 text-sm sm:text-base h-10"
                        required
                         min="1"
                         step="1"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="R36" className="text-slate-700 font-medium text-sm sm:text-base">
                        Meters (for Coreless Calc)
                      </Label>
                      <Input
                        name="R36"
                        type="number"
                        placeholder="Default: 1000"
                        value={inputs.R36}
                        onChange={handleChange}
                        className="border-slate-200 focus:border-blue-300 text-sm sm:text-base h-10"
                         required
                         min="1"
                         step="1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-1.5">
                      <Label htmlFor="printed" className="text-slate-700 font-medium text-sm sm:text-base">
                        Print Type
                      </Label>
                      <Select value={inputs.printed} onValueChange={handleSelectChange('printed')} required>
                        <SelectTrigger className="border-slate-200 focus:border-blue-300 text-sm sm:text-base h-10">
                          <SelectValue placeholder="Select print type" />
                        </SelectTrigger>
                        <SelectContent>
                          {printedOptions.map(opt => (
                            <SelectItem key={opt} value={opt}>
                              {opt.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="paste" className="text-slate-700 font-medium text-sm sm:text-base">
                        Paste Type
                      </Label>
                      <Select value={inputs.paste} onValueChange={handleSelectChange('paste')} required>
                        <SelectTrigger className="border-slate-200 focus:border-blue-300 text-sm sm:text-base h-10">
                          <SelectValue placeholder="Select paste type" />
                        </SelectTrigger>
                        <SelectContent>
                          {pasteOptions.map(opt => (
                            <SelectItem key={opt} value={opt}>
                              {opt.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 w-full sm:w-auto text-sm sm:text-base py-2 px-4"
                      disabled={!inputs.bopp_film || !inputs.adhesive || !inputs.bopp_tape_mtrs || !inputs.printed || !inputs.paste || loadingRates || isCalculating }
                    >
                       {isCalculating ? (
                         <>
                           <Loader2 className="h-4 w-4 animate-spin" />
                           Calculating...
                         </>
                       ) : (
                         <>
                           Calculate Results <ArrowRight className="h-4 w-4" />
                         </>
                       )}
                    </Button>
                  </div>

                  {calculationError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3 sm:p-4 rounded-md mt-2 text-sm sm:text-base">
                      {calculationError}
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            {output ? (
              <div className="space-y-6 sm:space-y-8">

<div className="bg-slate-50 min-h-screen font-sans">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8 border border-slate-200">
      <div className="bg-gradient-to-r from-blue-800 to-indigo-900 px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Key Manufacturing Results</h2>
            <p className="text-blue-100 text-xs sm:text-sm mt-1">Primary calculation outputs for BOPP tape manufacturing</p>
          </div>
          <div className="hidden sm:block">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Production Active
            </span>
          </div>
        </div>
      </div>
      <div className="px-4 sm:px-6 py-5 bg-gradient-to-b from-slate-50 to-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden hover:shadow transition-shadow duration-200">
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border-b border-slate-200">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 flex items-center">
                <div className="w-1 h-3.5 sm:h-4 bg-blue-700 mr-1.5 sm:mr-2 rounded"></div>
                Manufacturing Rates
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-700 tracking-wider">Parameter</th>
                    <th scope="col" className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-xs font-medium text-slate-700 tracking-wider">Base Rate</th>
                    <th scope="col" className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-xs font-medium text-slate-700 tracking-wider">Of MIC</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  <tr>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">Microns</td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-700">{formatValue(output.R1)}</td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-700">{formatValue(output.R2)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">Jumbo Rate</td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-700">{formatValue(output.R3)}</td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-700">{formatValue(output.R4)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">288 MM Rate</td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-700">{formatValue(output.R5)}</td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-700">{formatValue(output.R6)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden hover:shadow transition-shadow duration-200">
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border-b border-slate-200">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 flex items-center">
                <div className="w-1 h-3.5 sm:h-4 bg-blue-700 mr-1.5 sm:mr-2 rounded"></div>
                Jumbo Roll Weights
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-700 tracking-wider">Jumbo Wt 1315</th>
                    <th scope="col" className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-700 tracking-wider">Jumbo Wt 1610</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  <tr>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700">{formatValue(output.R7)}</td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700">{formatValue(output.R8)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700">{formatValue(output.R9)}</td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700">{formatValue(output.R10)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8 border border-slate-200">
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Weight Calculations</h2>
            <p className="text-blue-100 text-xs sm:text-sm mt-1">Production weight analytics</p>
          </div>
          <div className="hidden sm:block">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-200 text-blue-800">
              Updated Hourly
            </span>
          </div>
        </div>
      </div>
      <div className="px-4 sm:px-6 py-5">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-700 tracking-wider">Parameter</th>
                <th scope="col" className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-xs font-medium text-slate-700 tracking-wider">Value</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              <tr>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">Scale Weight</td>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-700">{formatValue(output.R11)}</td>
              </tr>
              <tr>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">Box Weight</td>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-700">{formatValue(output.R12)}</td>
              </tr>
              <tr>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">Sq Mtrs Rate</td>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-700">{formatValue(output.R13)}</td>
              </tr>
              <tr>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">Per Pcs Wt (48mm)</td>
                <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-700">{formatValue(output.R14)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8 border border-slate-200">
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Size-Based Calculations</h2>
            <p className="text-blue-100 text-xs sm:text-sm mt-1">
              Microns: {formatValue(output.R1)} • BOPP Mtrs: {formatValue(output.bopp_tape_mtrs)}
            </p>
          </div>
          <div className="mt-2 sm:mt-0">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-200 text-blue-800">
              Rate per piece for different tape widths
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-5 sm:py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden hover:shadow transition-shadow duration-200">
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border-b border-slate-200">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 flex items-center">
                <div className="w-1 h-3.5 sm:h-4 bg-blue-700 mr-1.5 sm:mr-2 rounded"></div>
                Standard Width Rates
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-700 tracking-wider">Size (mm)</th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-xs font-medium text-slate-700 tracking-wider">Value</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {[12, 24, 36, 48, 60, 72, 96].map((size, idx) => (
                    <tr key={size} className="hover:bg-slate-50">
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">{size}</td>
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-right text-gray-700">
                        {formatValue(output[`R${15 + idx}`])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden hover:shadow transition-shadow duration-200">
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border-b border-slate-200">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 flex items-center">
                <div className="w-1 h-3.5 sm:h-4 bg-blue-700 mr-1.5 sm:mr-2 rounded"></div>
                Standard Width Rates
              </h3>
              <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
                Per {formatValue(output.R36)} Meters • Production Metrics
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-700 tracking-wider">Size (mm)</th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-xs font-medium text-slate-700 tracking-wider">Value</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {[
                    { size: 36, key: 'R25' },
                    { size: 48, key: 'R23' },
                    { size: 60, key: 'R26' },
                    { size: 72, key: 'R24' },
                  ].map(({ size, key }) => (
                    <tr key={size} className="hover:bg-slate-50">
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">{size}</td>
                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-right text-gray-700">{formatValue(output[key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

                 <div className="flex justify-end mt-4 sm:mt-6">
                   <Button
                     onClick={handleGenerateRateCard}
                     className="bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2 text-sm sm:text-base py-2 px-4"
                     disabled={isGeneratingRateCard}
                   >
                     {isGeneratingRateCard ? (
                       <>
                         <Loader2 className="h-4 w-4 animate-spin" />
                         Generating...
                       </>
                     ) : (
                       <>
                         <Printer className="h-4 w-4" />
                         Generate Rate Card
                       </>
                     )}
                   </Button>
                 </div>
                </div>
             ) : (
                 <div className="text-center py-6 sm:py-8 text-slate-600 text-sm sm:text-base">
                   <p>Enter parameters in the Calculator tab and click "Calculate Results" to see the output.</p>
                 </div>
             )}
          </TabsContent>
          <TabsContent value="rates">
            {isAdmin ? (
              <Card className="shadow-lg border-slate-200 rounded-lg">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-slate-100 p-4 sm:p-6 rounded-t-lg">
                  <CardTitle className="text-xl sm:text-2xl text-slate-800">Material Rates Management</CardTitle>
                  <CardDescription className="text-slate-500 text-sm sm:text-base mt-1">
                    Current system rates for calculation parameters
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
                 {loadingRates ? (
                    <div className="flex items-center justify-center py-6 sm:py-8">
                       <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-amber-600 mr-2" />
                       <span className="text-sm sm:text-base text-slate-600">Loading rates...</span>
                    </div>
                 ) : dbRates ? (
                    <>
                      <div className="overflow-x-auto mb-4 sm:mb-6 max-h-80 sm:max-h-96 rounded-md border border-slate-200">
                        <Table className="min-w-full sm:min-w-[450px]">
                          <TableHeader>
                            <TableRow className="bg-slate-100">
                              <TableHead className="font-semibold text-slate-700 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm min-w-[150px] sm:min-w-[200px]">Parameter</TableHead>
                              <TableHead className="font-semibold text-slate-700 text-right px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="text-xs sm:text-sm">
                            {Object.entries(dbRates)
                                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                                .map(([key, value]) => (
                                <TableRow key={key} className="hover:bg-slate-50/50">
                                    <TableCell className="font-medium px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">{key.replace(/_/g, ' ')}</TableCell>
                                    <TableCell className="text-right px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">{value}</TableCell>
                                </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="mt-4 sm:mt-6">
                        <Button
                          onClick={handleNavigateToRates}
                          className="bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2 text-sm sm:text-base py-2 px-4"
                          disabled={isNavigatingToRates}
                        >
                          {isNavigatingToRates ? (
                             <>
                               <Loader2 className="h-4 w-4 animate-spin" />
                               Navigating...
                             </>
                          ) : (
                             "Manage Material Rates"
                          )}
                        </Button>
                      </div>
                    </>
                 ) : (
                     <div className="text-center py-6 sm:py-8 text-slate-600 text-sm sm:text-base">
                         <p>Could not load material rates.</p>
                         <Button onClick={handleRetryRates} variant="outline" className="mt-3 sm:mt-4 text-sm sm:text-base py-2 px-4" disabled={isRetryingRates || loadingRates}>
                            {(isRetryingRates || loadingRates) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                             Retry Loading Rates
                         </Button>
                     </div>
                 )}
                </CardContent>
              </Card>
            ) : null }
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex justify-end text-slate-500 text-xs sm:text-sm">
            <Button
               variant="outline"
               onClick={handleNavigateToDashboard}
               className="border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 py-2 px-4"
               disabled={isNavigatingToDashboard}
            >
               {isNavigatingToDashboard ? (
                  <>
                     <Loader2 className="h-4 w-4 animate-spin" />
                     Navigating...
                  </>
               ) : (
                  <>
                     <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                  </>
               )}
            </Button>
        </div>
         <div className="mt-4 text-center text-slate-500 text-xs sm:text-sm">
            <p>©Copyright {typeof window !== 'undefined' ? new Date().getFullYear() : ''} J M PlastoPack Pvt. Ltd. All rights reserved.</p>
         </div>
      </div>
    </div>
  );
}


// Export a wrapper component that uses ProtectedRoute
export default function BoppCalculator() {
    return (
        // Allow both admin and employee to access this page
        <ProtectedRoute allowedRoles={['admin', 'employee']}>
            <BoppCalculatorContent />
        </ProtectedRoute>
    );
}

    

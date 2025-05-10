
'use server';
import { Database } from 'sqlite3';
import { open } from 'sqlite';
import type { User } from './types'; // Assuming User type is defined here

// Define type for rate object in the database
interface RateRecord {
    id: number;
    key: string;
    value: number;
}

// Define type for the rates object used in the application
// Use RatesObject for the snapshot, ensuring values are numbers or strings based on context
export type RatesObject = Record<string, number | string>; // Allow string for input state, number for DB

// Define type for a history record
export interface RateHistoryEntry {
    id: number;
    changed_at: string; // ISO 8601 date string
    changed_by_id: string;
    changed_by_name: string;
    rates_snapshot: RatesObject; // Parsed JSON snapshot (values can be numbers/strings)
}

let dbInstance: any = null; // Keep track of the DB instance

async function openDb() {
  if (dbInstance) return dbInstance;

  try {
    const db = await open({
      filename: './mydb.sqlite',
      driver: require('sqlite3').Database
    });
    dbInstance = db;

    console.log("Database opened or reused.");

    // Create tables if they don’t exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS bopp_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value REAL NOT NULL
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS bopp_rates_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        changed_by_id TEXT NOT NULL,
        changed_by_name TEXT NOT NULL,
        rates_snapshot TEXT NOT NULL
      );
    `);

    // ❌ Removed all the default `INSERT OR IGNORE` statements here.

    return db;
  } catch (e) {
    console.error("Failed to open database:", e);
    dbInstance = null;
    throw e;
  }
}


// Update BOPP rate ONLY (no history recording here) - Use INSERT OR REPLACE
export async function updateBOPPRate(
    key: string,
    value: number, // Expect numeric value for DB update
    changedBy: User // User info still useful for potential logging, though not history
): Promise<{ success: boolean; message?: string }> {
  if (!changedBy || !changedBy.id || !changedBy.name) {
    console.error("DB Update failed: User information is missing.");
    return { success: false, message: "User performing the change must be identified." };
  }
   if (isNaN(value) || value < 0) { // Added validation for numeric value
       console.error(`DB Update failed: Invalid numeric value provided for ${key}: ${value}`);
       return { success: false, message: `Invalid or negative value provided for ${key}.` };
   }


  let db;
  try {
    db = await openDb();

    // Use INSERT OR REPLACE for simplicity: Inserts if key doesn't exist, replaces if it does.
    const result = await db.run(
        `INSERT OR REPLACE INTO bopp_rates (key, value) VALUES (?, ?)`,
        key,
        value
    );

    if (result.changes === 0) {
       console.log(`DB Update: No changes needed for rate "${key}" (value ${value} likely unchanged).`);
       return { success: true, message: "No change detected for this rate." };
    }

    console.log(`DB Update: Successfully inserted/replaced rate for "${key}" with value ${value} by ${changedBy.name} (${changedBy.id}). Rows modified: ${result.changes}`);
    return { success: true };

  } catch (e: any) { // Type error as any
    console.error(`DB Update Error: Failed to update/insert BOPP rate for ${key}:`, e);
    return { success: false, message: `An error occurred while updating the rate for ${key}.` };
  }
}

// Function to explicitly record the current rate state to history
export async function recordRateHistory(
    changedBy: User
): Promise<{ success: boolean; message?: string }> {
     if (!changedBy || !changedBy.id || !changedBy.name) {
        console.error("History recording failed: User information is missing.");
        return { success: false, message: "User performing the change must be identified." };
     }

     let db;
     try {
        db = await openDb();

        // Start transaction
        await db.exec('BEGIN TRANSACTION');

        // 1. Get the current state of all rates
        const currentRates = await db.all<RateRecord[]>("SELECT key, value FROM bopp_rates"); // Fetch all keys
        if (!currentRates || currentRates.length === 0) {
            console.warn("History Recording: No rates found in the database to record.");
            await db.exec('ROLLBACK'); // Rollback if no rates found
            return { success: false, message: "No rates found to record." };
        }
        const ratesSnapshot: RatesObject = currentRates.reduce((acc, curr) => {
            acc[curr.key] = curr.value; // Store numeric values in snapshot
            return acc;
        }, {} as RatesObject);

        // 2. Insert the snapshot into the history table
        await db.run(
            `INSERT INTO bopp_rates_history (changed_by_id, changed_by_name, rates_snapshot) VALUES (?, ?, ?)`,
            changedBy.id,
            changedBy.name,
            JSON.stringify(ratesSnapshot) // Store numeric snapshot as JSON
        );

        // Commit transaction
        await db.exec('COMMIT');

        console.log(`History Recording: Successfully recorded snapshot by ${changedBy.name} (${changedBy.id}).`);
        return { success: true };

     } catch (e) {
         if (db) await db.exec('ROLLBACK').catch(rbErr => console.error("History recording rollback failed:", rbErr));
         console.error(`History Recording Error: Failed to record rate history:`, e);
         return { success: false, message: "An error occurred while recording rate history." };
     }
}


// Get all current BOPP rates (returns numeric values)
export async function getAllBOPPRates(): Promise<Record<string, number>> {
  try {
    const db = await openDb(); // Ensures essential keys are checked/inserted
    const ratesRecords = await db.all<RateRecord[]>("SELECT key, value FROM bopp_rates");
    const ratesObject: Record<string, number> = ratesRecords.reduce((acc, curr) => {
        acc[curr.key] = curr.value; // Return numeric values
        return acc;
    }, {});
     console.log("Returning from getAllBOPPRates:", ratesObject); // Log what's being returned
    return ratesObject;
  } catch (e) {
    console.error("Get all bopp rates error:", e);
    throw new Error("Failed to fetch current BOPP rates.");
  }
}

// Get the last N rate history entries
export async function getRateHistory(limit: number = 3): Promise<RateHistoryEntry[]> {
    try {
        const db = await openDb();
        const historyRecords = await db.all<{
            id: number;
            changed_at: string;
            changed_by_id: string;
            changed_by_name: string;
            rates_snapshot: string; // JSON string from DB
        }[]>(
            `SELECT id, changed_at, changed_by_id, changed_by_name, rates_snapshot
             FROM bopp_rates_history
             ORDER BY changed_at DESC
             LIMIT ?`,
            limit
        );

        // Parse the JSON snapshot for each entry
        const historyEntries: RateHistoryEntry[] = historyRecords.map(record => {
             try {
                 // Ensure snapshot values are numbers where appropriate
                 const parsedSnapshot: Record<string, any> = JSON.parse(record.rates_snapshot);
                 const numericSnapshot: RatesObject = {};
                 for (const key in parsedSnapshot) {
                     // Attempt to parse if it's a string representation of a number, otherwise keep original
                     const numValue = parseFloat(parsedSnapshot[key]);
                     numericSnapshot[key] = !isNaN(numValue) ? numValue : parsedSnapshot[key];
                 }

                 return {
                     ...record,
                     rates_snapshot: numericSnapshot
                 };
             } catch (parseError) {
                 console.error(`Error parsing snapshot for history ID ${record.id}:`, parseError);
                 return { // Return a fallback entry or skip
                     ...record,
                     rates_snapshot: {} // Empty object on parse error
                 };
             }
        });

        return historyEntries;

    } catch (e) {
        console.error("Get rate history error:", e);
        throw new Error("Failed to fetch BOPP rate history.");
    }
}



'use server';
  import { Database } from 'sqlite3';
  import { open } from 'sqlite';
  import crypto from 'crypto';
  import type { User } from './types'; // Import the User type

  let dbInstance: any = null;

  // Use the imported User type, potentially extending it if DB has more fields
  interface UserRecord extends User {
      password?: string; // Make password optional as employees don't use it directly
      otp?: string | null;
      otp_created_at?: string | null;
  }

  async function openDb() {
    // Singleton pattern
    if (dbInstance) {
      return dbInstance;
    }
    try {
      console.log("Attempting to open database...");
      const db = await open({
        filename: './mydb.sqlite',
        driver: require('sqlite3').Database // Use require for driver
      });
      console.log("Database opened successfully.");

      await db.run('PRAGMA foreign_keys = ON;');
      console.log("Foreign key constraints enabled.");

      // Updated users table schema
      await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          password TEXT NOT NULL, -- Keep password for admin, placeholder for employee
          role TEXT NOT NULL CHECK(role IN ('admin', 'employee')),
          otp TEXT,
          otp_created_at DATETIME
        )
      `);
      console.log("'users' table checked/created (with OTP fields).");

      // Check and add columns if they don't exist
       const tableInfo = await db.all("PRAGMA table_info(users)");
       const columns = tableInfo.map(col => col.name);
       if (!columns.includes('name')) {
           await db.exec('ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT "Unknown"');
           console.log("Added 'name' column to users table.");
       }
       if (!columns.includes('otp')) {
           await db.exec('ALTER TABLE users ADD COLUMN otp TEXT');
           console.log("Added 'otp' column to users table.");
       }
       if (!columns.includes('otp_created_at')) {
           await db.exec('ALTER TABLE users ADD COLUMN otp_created_at DATETIME');
           console.log("Added 'otp_created_at' column to users table.");
       }

      // Create bopp_rates table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS bopp_rates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value REAL NOT NULL
        )
      `);
      console.log("'bopp_rates' table checked/created.");

       // Create bopp_rates_history table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS bopp_rates_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          changed_by_id TEXT NOT NULL,
          changed_by_name TEXT NOT NULL,
          rates_snapshot TEXT NOT NULL -- Store rates as JSON string
        )
      `);
      console.log("'bopp_rates_history' table checked/created.");


      const initialRates = [
        { key: 'SINGLE_COLOUR_PRINTED', value: 150 },
        { key: 'DOUBLE_COLOUR_PRINTED', value: 225 },
        { key: 'THREE_COLOUR_PRINTED', value: 300 },
        { key: 'FOUR_COLOUR_PRINTED', value: 350 },
        { key: 'FULL_PRINT', value: 10 },
        { key: 'MILKY_WHITE', value: 160 },
        { key: 'BROWN_TAPE', value: 105 },
        { key: 'COLOR_TAPE', value: 250 },
        { key: 'TRANSPARENT', value: 0 },
        { key: 'PACKING_COST', value: 220 },
        { key: 'BOPP_FILM_RATE', value: 118 },
        { key: 'ADHESIVE_RATE', value: 11 },
        { key: 'COATING_EXP', value: 12 },
        { key: 'PROFIT', value: 12 },
        { key: 'ADHESIVE_LESS_RATE', value: 0 },
        { key: 'NATURAL', value: 0 }, // Added NATURAL with initial value 0
      ];

      const stmtRates = await db.prepare('INSERT OR IGNORE INTO bopp_rates (key, value) VALUES (?, ?)');
      for (const rate of initialRates) {
        await stmtRates.run(rate.key, rate.value);
      }
      await stmtRates.finalize();
      console.log("Initial BOPP rates checked/inserted.");

      // Insert/Replace default users
       const defaultUsers = [
         { id: 'admin', name: 'Admin User', password: 'admin', role: 'admin' },
         { id: 'employee', name: 'Employee User', password: 'employee_otp_login', role: 'employee' },
       ];

       // Use INSERT OR IGNORE to avoid replacing existing users if they were modified
       const stmtUsers = await db.prepare('INSERT OR IGNORE INTO users (id, name, password, role, otp, otp_created_at) VALUES (?, ?, ?, ?, NULL, NULL)');
       for (const user of defaultUsers) {
           const finalPassword = user.password; // Using plain text
           await stmtUsers.run(user.id, user.name, finalPassword, user.role);
       }
       await stmtUsers.finalize();
       console.log("Default users checked/inserted (ignored if existing).");

      // Verify default admin
       const adminUser: UserRecord | undefined = await db.get('SELECT id, name, role, password FROM users WHERE id = ?', 'admin');
        if (adminUser && adminUser.role === 'admin' && adminUser.password === 'admin' && adminUser.name === 'Admin User') {
          console.log("Default admin user OK.");
        } else if (!adminUser) {
           console.error("Default admin user missing. Attempting to insert...");
           await db.run('INSERT OR IGNORE INTO users (id, name, password, role, otp, otp_created_at) VALUES (?, ?, ?, ?, NULL, NULL)', 'admin', 'Admin User', 'admin', 'admin');
           console.log("Inserted default admin user.");
        } else {
            console.warn("Default admin user exists but differs from expected defaults (password/name might have changed).", adminUser);
        }
      // Verify default employee
       const employeeUser: UserRecord | undefined = await db.get('SELECT id, name, role FROM users WHERE id = ?', 'employee');
        if (employeeUser && employeeUser.role === 'employee' && employeeUser.name === 'Employee User') {
           console.log("Default employee user OK.");
       } else if (!employeeUser) {
           console.error("Default employee user missing. Attempting to insert...");
           await db.run('INSERT OR IGNORE INTO users (id, name, password, role, otp, otp_created_at) VALUES (?, ?, ?, ?, NULL, NULL)', 'employee', 'Employee User', 'employee_otp_login', 'employee');
           console.log("Inserted default employee user.");
       } else {
           console.warn("Default employee user exists but differs from expected defaults (name might have changed).", employeeUser);
       }

      dbInstance = db;
      console.log("Database initialization complete.");
      return db;
    } catch (e) {
      console.error("Failed to open or initialize database:", e);
      dbInstance = null;
      throw e;
    }
  }

  export async function getUserRoleAndName(id: string): Promise<{ role: string; name: string } | null> {
      console.log(`Fetching role and name for user ID: ${id}`);
      try {
          const db = await openDb();
          const user: Pick<UserRecord, 'role' | 'name'> | undefined = await db.get('SELECT role, name FROM users WHERE id = ?', id); // Use Pick
          if (user) {
              console.log(`Info found for ${id}: Role=${user.role}, Name=${user.name}`);
              return { role: user.role, name: user.name };
          } else {
              console.log(`No user found with ID: ${id}`);
              return null;
          }
      } catch (e) {
          console.error(`Get user info error for ID ${id}:`, e);
          return null;
      }
  }

  export async function authenticateUser(id: string, credential: string, role: 'admin' | 'employee'): Promise<boolean> { // Use specific role type
    console.log(`Attempting authentication for user ID: ${id}, Role: ${role}`);
    try {
      const db = await openDb();

      if (role === 'admin') {
        console.log(`Authenticating admin ${id} with password.`);
        const user: UserRecord | undefined = await db.get('SELECT password, role FROM users WHERE id = ?', id);
        // Ensure both role and password match
        if (user && user.role === 'admin' && user.password === credential) {
            console.log(`Admin authentication successful for user: ${id}`);
            return true;
        }
        console.log(`Admin authentication failed for user: ${id}. Provided: '${credential}', Expected: '${user?.password}', RoleMatch: ${user?.role === 'admin'}`);
        return false;
      } else { // role === 'employee'
        console.log(`Authenticating employee ${id} with OTP.`);
        const user: UserRecord | undefined = await db.get('SELECT otp, otp_created_at, role FROM users WHERE id = ?', id);

        if (!user || user.role !== 'employee') {
            console.log(`Auth failed for ${id}: User not found or not an employee.`);
            return false;
        }
        if (!user.otp || !user.otp_created_at) {
          console.log(`Auth failed for ${id}: No active OTP found or generated.`);
          return false;
        }

        const otpCreatedAt = new Date(user.otp_created_at).getTime();
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        console.log(`OTP Timestamps for ${id}: CreatedAt=${user.otp_created_at} (${otpCreatedAt}), Now=${now}, Diff=${now - otpCreatedAt}ms, MaxDiff=${fiveMinutes}ms`);

        if (now - otpCreatedAt > fiveMinutes) {
          console.log(`Auth failed for ${id}: OTP expired.`);
          await db.run('UPDATE users SET otp = NULL, otp_created_at = NULL WHERE id = ?', id);
          console.log(`Expired OTP cleared for user ${id}.`);
          return false;
        }

        if (user.otp === credential) {
          console.log(`Auth success for ${id}: OTP valid.`);
          await db.run('UPDATE users SET otp = NULL, otp_created_at = NULL WHERE id = ?', id);
          console.log(`OTP cleared for user ${id} after successful login.`);
          return true;
        }
        console.log(`Auth failed for ${id}: Invalid OTP provided.`);
        return false;
      }
     } catch (e) {
      console.error(`Authentication error for ID ${id}:`, e);
      return false;
    }
  }

  export async function addUser(id: string, name: string, password: string, role: 'admin' | 'employee'): Promise<{ success: boolean; message?: string }> {
    console.log(`Attempting to add user: ID=${id}, Name=${name}, Role=${role}`);
    if (!id || !name || !role) { // Password only required for admin during creation
      const missing = [];
      if (!id) missing.push("User ID");
      if (!name) missing.push("Name");
      if (!role) missing.push("Role");
      console.error("Add user failed: Missing required fields:", missing.join(', '));
      return { success: false, message: `Missing required fields: ${missing.join(', ')}.` };
    }
    if (role === 'admin' && !password) {
         console.error("Add user failed: Password is required for admin role.");
         return { success: false, message: "Password is required for admin role." };
    }

     const passwordToStore = role === 'admin' ? password : 'employee_otp_login'; // Placeholder for employees

    try {
      const db = await openDb();
      // Check if user already exists
      const existingUser: Pick<UserRecord, 'id'> | undefined = await db.get('SELECT id FROM users WHERE id = ?', id);
      if (existingUser) {
           console.warn(`Add user failed: User ID '${id}' already exists.`);
           return { success: false, message: "User ID already exists." };
      }

      // Insert the new user
      await db.run(
        `INSERT INTO users (id, name, password, role, otp, otp_created_at) VALUES (?, ?, ?, ?, NULL, NULL)`,
        id,
        name,
        passwordToStore,
        role
      );
      console.log(`User added successfully: id=${id}, name=${name}, role=${role}`);
      return { success: true };
    } catch (e: any) {
       // Catch potential constraint errors just in case the check above fails due to race conditions (less likely with sqlite)
       if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || (e.message && e.message.toLowerCase().includes('unique constraint failed: users.id'))) {
           console.warn(`Add user failed (constraint): User ID '${id}' already exists.`);
           return { success: false, message: "User ID already exists." };
       }
       console.error(`Add user failed for ID '${id}' due to unexpected database error:`, e);
       return { success: false, message: "Failed to add user due to a database error." };
    }
  }


  function generateOTP(): string {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  export async function generateAndStoreOTP(id: string): Promise<{ success: boolean; message?: string; otp?: string }> {
    console.log(`Generating OTP for user ID: ${id}`);
    try {
      const db = await openDb();
      const user: Pick<UserRecord, 'role'> | undefined = await db.get('SELECT role FROM users WHERE id = ?', id);

      if (!user) {
          console.warn(`OTP Generation failed: User ID '${id}' not found.`);
          return { success: false, message: "User not found." };
      }
      if (user.role !== 'employee') {
          console.warn(`OTP Generation failed: User ID '${id}' is not an employee (role: ${user.role}).`);
          return { success: false, message: "OTP can only be generated for employees." };
      }

      const otp = generateOTP();
      const now = new Date().toISOString(); // Use ISO string format for DATETIME

      const result = await db.run(
        `UPDATE users SET otp = ?, otp_created_at = ? WHERE id = ?`,
        otp,
        now,
        id
      );

      if (result.changes === 0) {
           console.error(`OTP Generation failed: Failed to update OTP for user '${id}'.`);
           return { success: false, message: "Failed to update OTP (User might not exist or DB error)." };
      }

      console.log(`Generated OTP ${otp} for user ${id} at ${now}`);
      return { success: true, otp: otp, message: `OTP generated: ${otp}` };
    } catch (e) {
      console.error(`Generate and store OTP error for ID ${id}:`, e);
      return { success: false, message: "Failed to generate and store OTP due to a database error." };
    }
  }

  export async function revokeOTP(id: string): Promise<{ success: boolean; message?: string }> {
      console.log(`Revoking OTP for user ID: ${id}`);
      try {
          const db = await openDb();
          const result = await db.run(
              `UPDATE users SET otp = NULL, otp_created_at = NULL WHERE id = ?`,
              id
          );

          if (result.changes === 0) {
               console.log(`No active OTP found or user ${id} does not exist to revoke.`);
              // Still return success as the desired state (no OTP) is achieved
              return { success: true, message: "No active OTP found for the user or user does not exist." };
          }
          console.log(`Revoked OTP for user ${id}.`);
          return { success: true, message: "OTP revoked successfully." };
      } catch (e) {
          console.error(`Revoke OTP error for ID ${id}:`, e);
          return { success: false, message: "Failed to revoke OTP due to a database error." };
      }
  }

  export async function deleteUser(id: string): Promise<{ success: boolean; message?: string }> {
    console.log(`Attempting to delete user ID: ${id}`);
    if (id === 'admin' || id === 'employee') {
      console.warn(`Attempted to delete protected user: ${id}. Operation blocked.`);
      return { success: false, message: `The user '${id}' is protected and cannot be deleted.` };
    }
    try {
      const db = await openDb();
      console.log(`Executing DELETE query for user: ${id}`);
      const result = await db.run('DELETE FROM users WHERE id = ?', id);

      if (result.changes > 0) {
        console.log(`Successfully deleted user ${id}. Rows affected: ${result.changes}`);
        return { success: true };
      } else {
        console.log(`No user found with ID ${id} to delete, or DELETE query failed silently.`);
        return { success: false, message: "User not found or already deleted." };
      }
    } catch (e: any) {
      console.error(`Delete user error for ID ${id}:`, e);
       return { success: false, message: `An unexpected error occurred while deleting user ${id}.` };
    }
  }

  // Fetches all users, returning the full User record including otp_created_at
  export async function getAllUsers(): Promise<UserRecord[]> {
    console.log("Fetching all users from database.");
    try {
      const db = await openDb();
      // Select all relevant fields for the dashboard
      const users: UserRecord[] = await db.all('SELECT id, name, role, otp_created_at FROM users ORDER BY role DESC, name ASC'); // Order by role then name
      console.log(`Fetched ${users.length} users.`);
      // Cast to User[] before returning if needed, but UserRecord[] is more accurate here
      return users;
    } catch (e) {
      console.error("Get all users error:", e);
      return [];
    }
  }

  /**
   * Checks if a user with the given ID still exists in the database.
   * Used to verify session validity after potential user deletion.
   */
  export async function checkUserExists(id: string): Promise<boolean> {
    console.log(`Checking existence for user ID: ${id}`);
    try {
      const db = await openDb();
      const user: Pick<UserRecord, 'id'> | undefined = await db.get('SELECT id FROM users WHERE id = ?', id);
      const exists = !!user;
      console.log(`User ${id} exists: ${exists}`);
      return exists;
    } catch (e) {
      console.error(`Error checking user existence for ID ${id}:`, e);
      return false; // Assume user doesn't exist if there's an error
    }
  }

  /**
   * Updates the name and optionally the password for a given admin user ID.
   */
  export async function updateAdminDetails(id: string, newName: string, newPassword?: string): Promise<{ success: boolean; message?: string }> {
      console.log(`Attempting to update details for admin ID: ${id}. New name: ${newName}, Password change requested: ${!!newPassword}`);
      if (!id || !newName) {
          return { success: false, message: "User ID and new name are required." };
      }

      try {
          const db = await openDb();

          // Verify the user exists and is an admin
          const user: Pick<UserRecord, 'role'> | undefined = await db.get('SELECT role FROM users WHERE id = ?', id);
          if (!user) {
              return { success: false, message: "User not found." };
          }
          if (user.role !== 'admin') {
              return { success: false, message: "User is not an administrator." };
          }

          let query: string;
          let params: any[];

          if (newPassword) {
              // Update both name and password
              query = `UPDATE users SET name = ?, password = ? WHERE id = ?`;
              params = [newName, newPassword, id];
              console.log(`Updating name and password for admin ${id}.`);
          } else {
              // Update only the name
              query = `UPDATE users SET name = ? WHERE id = ?`;
              params = [newName, id];
               console.log(`Updating only name for admin ${id}.`);
          }

          const result = await db.run(query, ...params);

          if (result.changes === 0) {
              console.warn(`Update failed for admin ${id}. User might not exist or no changes were made.`);
              return { success: false, message: "Failed to update user details (User might not exist or no changes detected)." };
          }

          console.log(`Successfully updated details for admin ${id}.`);
          return { success: true };
      } catch (e) {
          console.error(`Update admin details error for ID ${id}:`, e);
          return { success: false, message: "An unexpected database error occurred while updating details." };
      }
  }

    
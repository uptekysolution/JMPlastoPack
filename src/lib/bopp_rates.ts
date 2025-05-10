'use server';
import { Database } from 'sqlite3';
import { open } from 'sqlite';

async function openDb() {
  try {
    const db = await open({
      filename: './mydb.sqlite',
      driver: Database
    });
    return db;
  } catch (e) {
    console.error("Failed to open database:", e);
    throw e;
  }
}




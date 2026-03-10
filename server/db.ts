import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  searches, searchResults,
  InsertSearch, InsertSearchResult,
  Search, SearchResult,
  engineStats, InsertEngineStat,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      id: user.id,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.isAnonymous !== undefined) {
      values.isAnonymous = user.isAnonymous;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role === undefined) {
      if (user.id === ENV.ownerId) {
        user.role = 'admin';
        values.role = 'admin';
        updateSet.role = 'admin';
      }
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Search-related database operations

export async function createSearch(search: InsertSearch): Promise<Search> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(searches).values(search);
  const result = await db.select().from(searches).where(eq(searches.id, search.id)).limit(1);

  if (result.length === 0) {
    throw new Error("Failed to create search");
  }

  return result[0];
}

export async function getSearchById(id: string): Promise<Search | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select().from(searches).where(eq(searches.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSearchesByUser(userId: string, limit: number = 20): Promise<Search[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(searches)
    .where(eq(searches.userId, userId))
    .orderBy(desc(searches.createdAt))
    .limit(limit);
}

export async function createSearchResults(results: InsertSearchResult[]): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  if (results.length === 0) return;

  await db.insert(searchResults).values(results);
}

export async function getSearchResults(searchId: string): Promise<SearchResult[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(searchResults).where(eq(searchResults.searchId, searchId));
}

// Engine performance stats

export async function createEngineStats(stats: InsertEngineStat[]): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save engine stats: database not available");
    return;
  }

  if (stats.length === 0) return;

  await db.insert(engineStats).values(stats);
}

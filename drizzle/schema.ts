import { mysqlEnum, mysqlTable, text, timestamp, varchar, int, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * isAnonymous=1 for auto-created anonymous session users.
 */
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isAnonymous: int("isAnonymous").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Search queries table - stores user search history and enables caching.
 * FULLTEXT index on `query` created in init-db.sql.
 */
export const searches = mysqlTable("searches", {
  id: varchar("id", { length: 64 }).primaryKey(),
  query: varchar("query", { length: 500 }).notNull(),
  pageStart: int("pageStart").notNull().default(2),
  pageEnd: int("pageEnd").notNull().default(4),
  engines: text("engines").notNull(), // JSON array of engine names
  userId: varchar("userId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  queryIdx: index("query_idx").on(table.query),
  userIdx: index("user_idx").on(table.userId),
}));

export type Search = typeof searches.$inferSelect;
export type InsertSearch = typeof searches.$inferInsert;

/**
 * Search results table - stores aggregated and ranked results.
 * FULLTEXT index on (title, snippet) created in init-db.sql.
 */
export const searchResults = mysqlTable("searchResults", {
  id: varchar("id", { length: 64 }).primaryKey(),
  searchId: varchar("searchId", { length: 64 }).notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  snippet: text("snippet"),
  sourceEngine: varchar("sourceEngine", { length: 50 }).notNull(),
  originalPosition: int("originalPosition").notNull(),
  originalPage: int("originalPage").notNull(),
  finalScore: int("finalScore").notNull(),
  isDuplicate: int("isDuplicate").notNull().default(0),
  duplicateOf: text("duplicateOf"),
  appearances: int("appearances").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  searchIdx: index("search_idx").on(table.searchId),
}));

export type SearchResult = typeof searchResults.$inferSelect;
export type InsertSearchResult = typeof searchResults.$inferInsert;

/**
 * Engine performance stats - tracks scrape timing, success/failure per engine per search.
 */
export const engineStats = mysqlTable("engineStats", {
  id: varchar("id", { length: 64 }).primaryKey(),
  searchId: varchar("searchId", { length: 64 }).notNull(),
  engine: varchar("engine", { length: 50 }).notNull(),
  durationMs: int("durationMs").notNull(),
  success: int("success").notNull().default(1),
  resultCount: int("resultCount").notNull().default(0),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  searchIdx: index("engine_search_idx").on(table.searchId),
  engineIdx: index("engine_name_idx").on(table.engine),
}));

export type EngineStat = typeof engineStats.$inferSelect;
export type InsertEngineStat = typeof engineStats.$inferInsert;

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { parse as parseCookie } from "cookie";
import { ANON_COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { getUser, upsertUser } from "../db";
import { nanoid } from "nanoid";

function getCookie(req: CreateExpressContextOptions["req"], name: string): string | undefined {
  // Use req.cookies if available (cookie-parser), otherwise parse manually
  if (req.cookies) return req.cookies[name];
  const header = req.headers.cookie;
  if (!header) return undefined;
  const parsed = parseCookie(header);
  return parsed[name];
}

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  isAnonymous: boolean;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let isAnonymous = false;

  // Use anonymous session via cookie
  const anonId = getCookie(opts.req, ANON_COOKIE_NAME);

  if (anonId) {
    const existing = await getUser(anonId);
    if (existing) {
      user = existing;
      isAnonymous = true;
    }
  }

  if (!user) {
    // Create new anonymous user
    const newId = nanoid();
    try {
      await upsertUser({
        id: newId,
        loginMethod: 'anonymous',
        isAnonymous: 1,
      });
      const created = await getUser(newId);
      if (created) {
        user = created;
        isAnonymous = true;

        const cookieOpts = getSessionCookieOptions(opts.req);
        opts.res.cookie(ANON_COOKIE_NAME, newId, {
          ...cookieOpts,
          maxAge: ONE_YEAR_MS,
        });
      }
    } catch (err) {
      console.warn("[Context] Failed to create anonymous user:", err);
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    isAnonymous,
  };
}

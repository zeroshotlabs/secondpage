export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerId: process.env.OWNER_OPEN_ID ?? "",
  apiKey: process.env.API_KEY ?? "",
  isProduction: process.env.NODE_ENV === "production",
};

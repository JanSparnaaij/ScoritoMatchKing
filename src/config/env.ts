import { loadEnvConfig } from "@next/env";
import { z } from "zod";

// Ensure local scripts (tsx/node) load .env the same way as Next.js runtime.
loadEnvConfig(process.cwd());

const envSchema = z.object({
  DATABASE_URL: z.string().default("file:./dev.db"),
  API_FOOTBALL_KEY: z.string().default(""),
  API_FOOTBALL_BASE_URL: z.url().default("https://v3.football.api-sports.io"),
  ODDS_API_KEY: z.string().default(""),
  ODDS_API_BASE_URL: z.url().default("https://api.the-odds-api.com/v4"),
  FOOTBALL_DATA_API_KEY: z.string().default(""),
  FOOTBALL_DATA_BASE_URL: z.url().default("https://api.football-data.org/v4"),
});

const parsedEnv = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  API_FOOTBALL_KEY: process.env.API_FOOTBALL_KEY,
  API_FOOTBALL_BASE_URL: process.env.API_FOOTBALL_BASE_URL,
  ODDS_API_KEY: process.env.ODDS_API_KEY,
  ODDS_API_BASE_URL: process.env.ODDS_API_BASE_URL,
  FOOTBALL_DATA_API_KEY: process.env.FOOTBALL_DATA_API_KEY,
  FOOTBALL_DATA_BASE_URL: process.env.FOOTBALL_DATA_BASE_URL,
});

export const env = {
  ...parsedEnv,
  ENABLE_EXTERNAL_SYNC: true,
} as const;

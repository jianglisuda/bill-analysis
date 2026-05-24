import dotenv from "dotenv";
import path from "node:path";

import { fileURLToPath } from "node:url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const requiredEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`缺少必要环境变量: ${key}`);
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 4100),
  databaseUrl: requiredEnv("DATABASE_URL"),
  uploadDir: path.resolve(rootDir, process.env.UPLOAD_DIR ?? "uploads"),
  maxFileMb: Number(process.env.MAX_FILE_MB ?? 80),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:8081",
};

export const maxFileBytes = config.maxFileMb * 1024 * 1024;

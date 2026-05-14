import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const configPath = path.resolve(process.cwd(), "config.local.json");
const fileConfig = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : {};

const databaseUrl = process.env.DATABASE_URL || fileConfig.databaseUrl;
const jwtSecret = process.env.JWT_SECRET || fileConfig.jwtSecret;

if (!databaseUrl || !jwtSecret) {
  throw new Error(
    `Missing databaseUrl/jwtSecret. Set DATABASE_URL and JWT_SECRET in the environment, or create config.local.json at ${configPath}.`
  );
}

function parseCorsOrigin(raw) {
  if (raw == null || raw === "") return undefined;
  if (raw === "*") return "*";
  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return raw;
}

const corsFromEnv = parseCorsOrigin(process.env.CORS_ORIGIN);
const corsOrigin =
  corsFromEnv !== undefined ? corsFromEnv : fileConfig.corsOrigin;

export const config = {
  ...fileConfig,
  databaseUrl,
  jwtSecret,
  port: Number(process.env.PORT || fileConfig.port || 3001),
  corsOrigin,
  gigachat: {
    baseUrl:
      process.env.GIGACHAT_BASE_URL ||
      fileConfig?.gigachat?.baseUrl ||
      "https://gigachat.devices.sberbank.ru/api/v1",
    authUrl:
      process.env.GIGACHAT_AUTH_URL ||
      fileConfig?.gigachat?.authUrl ||
      "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
    scope:
      process.env.GIGACHAT_SCOPE ||
      fileConfig?.gigachat?.scope ||
      "GIGACHAT_API_PERS",
    credentials:
      process.env.GIGACHAT_CREDENTIALS ||
      process.env.GIGACHAT_AUTH_KEY ||
      fileConfig?.gigachat?.credentials ||
      null,
    verifySsl:
      (process.env.GIGACHAT_VERIFY_SSL ?? fileConfig?.gigachat?.verifySsl ?? "true") !==
      "false",
  },
};

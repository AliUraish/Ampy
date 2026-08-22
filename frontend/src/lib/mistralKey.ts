import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Server-only. MISTRAL_API_KEY from the environment, else from the repo-root
 * or frontend-local .env (the shared Ampy key lives at the repo root).
 */
export function readMistralKey(): string | undefined {
  if (process.env.MISTRAL_API_KEY) return process.env.MISTRAL_API_KEY;
  for (const dir of [process.cwd(), path.resolve(process.cwd(), "..")]) {
    try {
      const line = readFileSync(path.join(dir, ".env"), "utf8")
        .split(/\r?\n/)
        .find((entry) => entry.startsWith("MISTRAL_API_KEY="));
      const value = line?.slice("MISTRAL_API_KEY=".length).trim().replace(/^['"]|['"]$/g, "");
      if (value) {
        process.env.MISTRAL_API_KEY = value;
        return value;
      }
    } catch {
      // keep looking
    }
  }
  return undefined;
}

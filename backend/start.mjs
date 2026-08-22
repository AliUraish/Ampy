#!/usr/bin/env node
// backend/start.mjs — start the full Ampy stack:
//   seller :8000, buyer :3001, deal-finder :4747, Next frontend :3000
//
// Usage from repo root: npm start

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadRootEnv(rootDir) {
  const envPath = path.join(rootDir, ".env");
  let loaded = 0;
  try {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
        loaded += 1;
      }
    }
  } catch {
    return 0;
  }
  return loaded;
}
const SELLER_DIR = path.join(__dirname, "seller");
const BUYER_DIR = path.join(__dirname, "buyer");
const DEAL_FINDER_DIR = path.join(__dirname, "deal-finder");
const FRONTEND_DIR = path.join(ROOT, "frontend");

const SELLER_HOST = process.env.SELLER_HOST || "127.0.0.1";
const SELLER_PORT = process.env.SELLER_PORT || "8000";
const BUYER_PORT = process.env.BUYER_PORT || "3001";
const DEAL_FINDER_PORT = process.env.DEAL_FINDER_PORT || "4747";
const FRONTEND_PORT = process.env.FRONTEND_PORT || "3000";
const SELLER_URL = `http://${SELLER_HOST}:${SELLER_PORT}`;

const children = [];
let shuttingDown = false;

function prefixPipe(child, name) {
  const tag = `[${name}]`;
  for (const stream of [child.stdout, child.stderr]) {
    if (!stream) continue;
    const rl = createInterface({ input: stream });
    rl.on("line", (line) => {
      process.stdout.write(`${tag} ${line}\n`);
    });
  }
}

function spawnProc(name, command, args, options) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  children.push(child);
  prefixPipe(child, name);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`[start] ${name} exited (code=${code}, signal=${signal}) — shutting down`);
    shutdown(code ?? 1);
  });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) child.kill("SIGKILL");
    }
    process.exit(code);
  }, 4000).unref();
}

async function waitForHealth(url, { attempts = 90, intervalMs = 500, label = "service" } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await delay(intervalMs);
  }
  throw new Error(`${label} health check failed: ${url} not ready`);
}

async function main() {
  const loaded = loadRootEnv(ROOT);
  console.log(`[start] Ampy full stack`);
  console.log(`[start] env: ${path.join(ROOT, ".env")} (${loaded} vars)`);
  console.log(`[start] frontend :${FRONTEND_PORT}  seller :${SELLER_PORT}  buyer :${BUYER_PORT}  deal-finder :${DEAL_FINDER_PORT}`);

  const sellerCmd = process.env.SELLER_CMD
    ? process.env.SELLER_CMD.split(" ")
    : ["uv", "run", "uvicorn", "app.main:app", "--host", SELLER_HOST, "--port", String(SELLER_PORT)];

  spawnProc("seller", sellerCmd[0], sellerCmd.slice(1), {
    cwd: SELLER_DIR,
    env: { ...process.env },
  });

  try {
    await waitForHealth(`${SELLER_URL}/health`, { label: "seller" });
  } catch (err) {
    console.error(`[start] ${err.message}`);
    shutdown(1);
    return;
  }
  console.log(`[start] seller healthy at ${SELLER_URL}`);

  spawnProc("buyer", "node", ["server.js"], {
    cwd: BUYER_DIR,
    env: {
      ...process.env,
      PORT: String(BUYER_PORT),
      SELLER_AGENT_URL: process.env.SELLER_AGENT_URL || SELLER_URL,
    },
  });

  spawnProc("deal-finder", "node", ["server.js"], {
    cwd: DEAL_FINDER_DIR,
    env: {
      ...process.env,
      PORT: String(DEAL_FINDER_PORT),
      DEAL_FINDER_PORT: String(DEAL_FINDER_PORT),
    },
  });

  try {
    await Promise.all([
      waitForHealth(`http://127.0.0.1:${BUYER_PORT}/`, { label: "buyer" }),
      waitForHealth(`http://127.0.0.1:${DEAL_FINDER_PORT}/health`, { label: "deal-finder" }),
    ]);
  } catch (err) {
    console.error(`[start] ${err.message}`);
    shutdown(1);
    return;
  }
  console.log(`[start] buyer healthy on :${BUYER_PORT}`);
  console.log(`[start] deal-finder healthy on :${DEAL_FINDER_PORT}`);

  const frontendCmd = process.env.FRONTEND_CMD
    ? process.env.FRONTEND_CMD.split(" ")
    : ["npm", "run", "dev", "--", "-p", String(FRONTEND_PORT)];

  spawnProc("frontend", frontendCmd[0], frontendCmd.slice(1), {
    cwd: FRONTEND_DIR,
    env: {
      ...process.env,
      PORT: String(FRONTEND_PORT),
      BUYER_URL: process.env.BUYER_URL || `http://127.0.0.1:${BUYER_PORT}`,
      SELLER_URL: process.env.SELLER_URL || SELLER_URL,
      DEAL_FINDER_URL: process.env.DEAL_FINDER_URL || `http://127.0.0.1:${DEAL_FINDER_PORT}`,
    },
  });

  console.log(`[start] frontend starting on http://127.0.0.1:${FRONTEND_PORT}`);
  console.log(`[start] open http://127.0.0.1:${FRONTEND_PORT}`);
  console.log(`[start] Ctrl+C to stop all`);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((err) => {
  console.error("[start] fatal:", err);
  shutdown(1);
});

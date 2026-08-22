#!/usr/bin/env node
// backend/start.mjs — start Ampy seller (Python :8000) then buyer (Node :3000).
//
// Usage from repo root: npm start
// Or: node backend/start.mjs

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SELLER_DIR = path.join(__dirname, "seller");
const BUYER_DIR = path.join(__dirname, "buyer");

const SELLER_HOST = process.env.SELLER_HOST || "127.0.0.1";
const SELLER_PORT = process.env.SELLER_PORT || "8000";
const BUYER_PORT = process.env.PORT || "3000";
const SELLER_URL = `http://${SELLER_HOST}:${SELLER_PORT}`;

const children = [];

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

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  // Force-kill after a short grace period.
  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) child.kill("SIGKILL");
    }
    process.exit(code);
  }, 3000).unref();
}

async function waitForHealth(url, { attempts = 60, intervalMs = 500 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await delay(intervalMs);
  }
  throw new Error(`seller health check failed: ${url} not ready`);
}

async function main() {
  console.log(`[start] Ampy backend — seller ${SELLER_URL}, buyer :${BUYER_PORT}`);
  console.log(`[start] loading env from ${path.join(ROOT, ".env")}`);

  // Prefer `uv run` when available; fall back to venv / system uvicorn.
  const sellerCmd = process.env.SELLER_CMD
    ? process.env.SELLER_CMD.split(" ")
    : ["uv", "run", "uvicorn", "app.main:app", "--host", SELLER_HOST, "--port", String(SELLER_PORT)];

  spawnProc("seller", sellerCmd[0], sellerCmd.slice(1), {
    cwd: SELLER_DIR,
    env: { ...process.env },
  });

  try {
    await waitForHealth(`${SELLER_URL}/health`);
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

  console.log(`[start] buyer starting on http://127.0.0.1:${BUYER_PORT}`);
  console.log(`[start] Ctrl+C to stop both`);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((err) => {
  console.error("[start] fatal:", err);
  shutdown(1);
});

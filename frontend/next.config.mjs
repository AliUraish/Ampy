import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Prefer the Ampy repo-root .env (shared MISTRAL_API_KEY) over frontend-local files.
loadEnvConfig(path.join(__dirname, ".."));
loadEnvConfig(__dirname);

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;

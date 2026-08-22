/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Prefer the Ampy repo-root .env (shared MISTRAL_API_KEY) over frontend-local files.
loadEnvConfig(path.join(__dirname, ".."));
loadEnvConfig(__dirname);

const nextConfig = {};

export default nextConfig;

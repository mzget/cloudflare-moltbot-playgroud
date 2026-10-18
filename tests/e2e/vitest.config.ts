import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const rootNodeModules = path.join(rootDir, "node_modules");
const backendNodeModules = path.join(rootDir, "backend", "node_modules");

// Prefer root node_modules when hoisted; fallback to backend/node_modules during transition
const activeNodeModules = fs.existsSync(path.join(rootNodeModules, "zod"))
  ? rootNodeModules
  : backendNodeModules;

export default {
  cacheDir: path.resolve(activeNodeModules, ".vite"),
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      zod: path.resolve(activeNodeModules, "zod"),
    },
  },
};

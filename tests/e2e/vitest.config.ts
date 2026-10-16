import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  cacheDir: path.resolve(__dirname, "../../backend/node_modules/.vite"),
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      zod: path.resolve(__dirname, "../../backend/node_modules/zod"),
    },
  },
};

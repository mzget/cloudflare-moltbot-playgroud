import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "strip-decorators-in-test",
      transform(code, id) {
        if (id.includes("chatAgent.ts")) {
          return {
            code: code.replace(/@callable\(\)\s*/g, ""),
            map: null,
          };
        }
      },
    },
  ],
});

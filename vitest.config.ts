import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    server: {
      deps: {
        // i18next-icu does `import IntlMessageFormat from "intl-messageformat"`, which is
        // the constructor in that package's ESM build but a namespace object under Node's
        // CJS interop. Vite resolves the ESM build for the real app; inlining these makes
        // the tests resolve them the same way instead of externalising them to Node.
        inline: ["i18next-icu", "intl-messageformat"],
      },
    },
  },
});

import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig([
  {
    ignores: ["out/**", ".next/**", "node_modules/**"],
  },
  {
    extends: [...next],
    rules: {
      // Unused imports piled up unnoticed because linting was skipped during
      // builds. Treat them as errors now that `next build` runs ESLint again;
      // a leading underscore is the documented opt-out for deliberate throwaways.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

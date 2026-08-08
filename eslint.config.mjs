import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import typescriptEslint from "@typescript-eslint/eslint-plugin";

export default defineConfig([
  {
    ignores: ["out/**", ".next/**", "node_modules/**"],
  },
  {
    extends: [...next],
    // Flat config resolves a rule's plugin from the *same* config object, and
    // `eslint-config-next` stopped re-exporting this namespace, so the rule
    // below silently failed to load and `next build` printed a config error
    // instead of linting anything. Registering the plugin here restores lint as
    // a build gate — which is the whole reason it was turned back on.
    plugins: { "@typescript-eslint": typescriptEslint },
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

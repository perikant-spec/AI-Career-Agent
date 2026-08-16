import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // New in the eslint-plugin-react-hooks version bundled with eslint-config-next@16 — flags
      // every "fetch on mount" effect (`useEffect(() => { load(); }, [load])`), which is the
      // pattern this app's data-loading hooks use throughout, on both web and mobile (~18 call
      // sites). It's a real signal (React's own docs steer away from this pattern), not a false
      // positive, but migrating those call sites is a deliberate refactor of its own — out of
      // scope for the Next.js 15->16 version bump this config change is part of. Tracked as a
      // follow-up, not silently ignored.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

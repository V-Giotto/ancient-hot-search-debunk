import { createRequire } from "node:module";
import reactHooks from "eslint-plugin-react-hooks";

// TS 7 的原生编译器不提供 createSourceFile；lint 的解析器使用其支持的 TS 6，
// 应用 typecheck/build 继续使用根包 TS 7。依赖由 workspace/lock 隔离，不强制 peer。
const require = createRequire(new URL("./tools/lint/package.json", import.meta.url));
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const globals = require("globals");

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "**/node_modules/**", "artifacts/**", "D:/**", "next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
);

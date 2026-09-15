import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const output = resolve(root, ".e2e-test-build");
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "e2e",
  "node_modules",
  "playwright-report",
  "test-results",
]);

function collectTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : collectTests(path);
    }
    return entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const tests = collectTests(root);
if (!tests.length) throw new Error("Nenhum teste unitário encontrado.");

rmSync(output, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      require.resolve("typescript/bin/tsc"),
      "--noEmit",
      "false",
      "--outDir",
      output,
      "--module",
      "commonjs",
      "--moduleResolution",
      "node",
      "--target",
      "es2022",
      "--esModuleInterop",
      "--skipLibCheck",
      ...tests,
    ],
    { cwd: root, stdio: "inherit" },
  );

  const compiledTests = tests.map((test) =>
    join(output, relative(root, test)).replace(/\.ts$/, ".js"),
  );
  execFileSync(process.execPath, ["--test", ...compiledTests], {
    cwd: root,
    stdio: "inherit",
  });
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true });
}

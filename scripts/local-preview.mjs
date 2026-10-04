// Isolate local-mode tests from the configured shared workspace and Metro's environment cache.
import {
  cpSync,
  existsSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const workspace = mkdtempSync(join(tmpdir(), "shiftline-local-"));
const port = Number(process.argv[2] ?? 8083);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Supply an available port between 1024 and 65535.");
for (const name of [
  "src",
  "public",
  "package.json",
  "app.json",
  "tsconfig.json",
]) {
  if (name === "public" && !existsSync(join(root, name))) continue;
  cpSync(join(root, name), join(workspace, name), { recursive: true });
}
symlinkSync(
  join(root, "node_modules"),
  join(workspace, "node_modules"),
  "junction",
);
// Shared node_modules must not reuse transforms from a different temporary app root.
writeFileSync(
  join(workspace, "metro.config.js"),
  `const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.cacheVersion = ${JSON.stringify(workspace)};
module.exports = config;
`,
);
const child = spawn(
  process.execPath,
  [
    join(root, "node_modules/expo/bin/cli"),
    "start",
    "--go",
    "--web",
    "--port",
    String(port),
  ],
  {
    cwd: workspace,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_NO_DOTENV: "1",
      EXPO_PUBLIC_SUPABASE_URL: "",
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  rmSync(workspace, { recursive: true, force: true });
  process.exitCode = 1;
});
child.on("exit", (code) => {
  rmSync(workspace, { recursive: true, force: true });
  process.exitCode = code ?? 0;
});

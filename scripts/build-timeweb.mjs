import { spawn } from "node:child_process";
import path from "node:path";
import "./validate-production-config.mjs";

const next = path.resolve("node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [next, "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

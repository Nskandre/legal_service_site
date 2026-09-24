import { spawn } from "node:child_process";
import path from "node:path";

const next = path.resolve("node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [next, "build"], {
  stdio: "inherit",
  env: { ...process.env, TIMEWEB_BUILD: "1", NEXT_TELEMETRY_DISABLED: "1" },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

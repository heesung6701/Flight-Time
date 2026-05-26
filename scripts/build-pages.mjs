import { spawnSync } from "node:child_process";

const result = spawnSync("vite", ["build"], { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);

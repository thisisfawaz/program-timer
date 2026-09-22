import { rmSync } from "node:fs";
import { execSync, spawn } from "node:child_process";

// 1. Clear the dev cache.
try {
  rmSync(".next", { recursive: true, force: true });
  console.log("Cleared .next");
} catch {
  /* ignore */
}

// 2. Free port 3000 if a stale server is squatting it.
try {
  if (process.platform === "win32") {
    const out = execSync('netstat -ano | findstr :3000', { encoding: "utf8" });
    const pids = new Set(
      out
        .split("\n")
        .filter((l) => l.includes("LISTENING"))
        .map((l) => l.trim().split(/\s+/).pop())
        .filter(Boolean),
    );
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`Freed port 3000 (killed PID ${pid})`);
      } catch {
        /* ignore */
      }
    }
  } else {
    // macOS/Linux: use lsof to find and kill listeners on 3000.
    try {
      const out = execSync("lsof -ti tcp:3000", { encoding: "utf8" });
      for (const pid of out.split("\n").map((s) => s.trim()).filter(Boolean)) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: "ignore" });
          console.log(`Freed port 3000 (killed PID ${pid})`);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* nothing on 3000 */
    }
  }
} catch {
  /* nothing on 3000 */
}

// 3. Start next dev, inheriting stdio so output shows in the terminal.
const child = spawn("next", ["dev"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));

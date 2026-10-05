import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

export const WORKER_BUILD = "8";
export const RENDER_ATTEMPTS = 2;

const pidFile = path.resolve(".remotion-worker.pid");
const buildFile = path.resolve("public", "generated", "worker.build");
const logFile = path.resolve("public", "generated", "worker.log");

let restarting = false;

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid() {
  if (!fs.existsSync(pidFile)) return 0;
  const pid = Number(fs.readFileSync(pidFile, "utf8").trim());
  return Number.isFinite(pid) ? pid : 0;
}

function workerIsCurrent() {
  const pid = readPid();
  if (!pid || !isAlive(pid)) return false;
  if (!fs.existsSync(buildFile)) return false;
  return fs.readFileSync(buildFile, "utf8").trim() === WORKER_BUILD;
}

function killWorker(pid: number) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/F", "/T", "/PID", String(pid)], { windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

function spawnWorker() {
  const tsxCli = path.resolve("node_modules/tsx/dist/cli.mjs");
  const script = path.resolve("scripts/render-worker.ts");
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = fs.openSync(logFile, "a");
  fs.writeFileSync(buildFile, WORKER_BUILD);
  const child = spawn(process.execPath, [tsxCli, script], {
    cwd: process.cwd(),
    env: process.env,
    detached: process.platform !== "win32",
    windowsHide: true,
    stdio: ["ignore", log, log],
  });
  if (child.pid) fs.writeFileSync(pidFile, String(child.pid));
  child.unref();
}

export function ensureRenderWorker() {
  if (workerIsCurrent() || restarting) return;
  restarting = true;
  const pid = readPid();
  if (pid && isAlive(pid)) {
    killWorker(pid);
    setTimeout(() => {
      try {
        if (!workerIsCurrent()) spawnWorker();
      } finally {
        restarting = false;
      }
    }, 800);
    return;
  }
  try {
    spawnWorker();
  } finally {
    restarting = false;
  }
}

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const tmpRoot = path.join(process.env.LOCALAPPDATA || os.tmpdir(), "lhci");
const chromeProfileDir = path.join(tmpRoot, "chrome-profile");

for (const dir of [tmpRoot, chromeProfileDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

const env = {
  ...process.env,
  TMPDIR: tmpRoot,
  TEMP: tmpRoot,
  TMP: tmpRoot,
  XDG_CACHE_HOME: path.join(tmpRoot, "cache"),
  CHROME_USER_DATA_DIR: chromeProfileDir,
};

const chromeFlags = [
  "--headless=new",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  `--user-data-dir=${chromeProfileDir}`,
].join(" ");

env.LHCI_CHROME_FLAGS = env.LHCI_CHROME_FLAGS
  ? `${env.LHCI_CHROME_FLAGS} ${chromeFlags}`
  : chromeFlags;

const lhciCli = path.join(repoRoot, "node_modules", "@lhci", "cli", "src", "cli.js");
const child = spawn(process.execPath, [lhciCli, "autorun", "--config=./lighthouserc.json"], {
  cwd: repoRoot,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

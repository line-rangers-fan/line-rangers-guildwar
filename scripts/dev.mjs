import { context } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";
await mkdir("dist", { recursive: true });
await copyFile("src/index.html", "dist/index.html");
const ctx = await context({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  outdir: "dist/assets",
  entryNames: "app",
  define: { "process.env.NODE_ENV": '"development"' },
});
await ctx.watch();
const child = spawn(process.execPath, ["--watch", "server/index.mjs"], {
  stdio: "inherit",
});
process.on("SIGINT", async () => {
  child.kill();
  await ctx.dispose();
  process.exit(0);
});

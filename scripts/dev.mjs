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
const readOption = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const child = spawn(process.execPath, ["--watch", "server/index.mjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...(readOption("--host") ? { HOST: readOption("--host") } : {}),
    ...(readOption("--port") ? { PORT: readOption("--port") } : {}),
  },
});
process.on("SIGINT", async () => {
  child.kill();
  await ctx.dispose();
  process.exit(0);
});


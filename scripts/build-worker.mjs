import { readFile, writeFile, mkdir, copyFile, cp } from "node:fs/promises";
import { build } from "esbuild";
const table = {};
for (const [path, type] of [
  ["/index.html", "text/html; charset=utf-8"],
  ["/assets/app.js", "application/javascript; charset=utf-8"],
  ["/assets/app.css", "text/css; charset=utf-8"],
])
  table[path] = { type, body: await readFile(`dist${path}`, "utf8") };
await writeFile(
  "worker/assets.generated.mjs",
  `export const assets=${JSON.stringify(table)};\n`,
);
await mkdir("worker-dist/server", { recursive: true });
await mkdir("worker-dist/.openai", { recursive: true });
await build({
  entryPoints: ["worker/index.mjs"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: "worker-dist/server/index.js",
  minify: true,
});
await copyFile(".openai/hosting.json", "worker-dist/.openai/hosting.json");
await cp("migrations","worker-dist/migrations",{recursive:true});
console.log("Built worker-dist/");

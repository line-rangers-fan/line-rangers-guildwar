import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  minify: true,
  outdir: "dist/assets",
  entryNames: "app",
  target: ["es2022"],
  define: { "process.env.NODE_ENV": '"production"' },
  sourcemap: false,
  legalComments: "eof",
});
let html = await readFile("src/index.html", "utf8");
for (const ext of ["js", "css"]) {
  const path = `/assets/app.${ext}`;
  const version = createHash("sha256").update(await readFile(`dist${path}`)).digest("hex").slice(0, 12);
  html = html.replace(path, `${path}?v=${version}`);
}
await writeFile("dist/index.html", html);
console.log("Built dist/");

import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
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
await copyFile("src/index.html", "dist/index.html");
console.log("Built dist/");

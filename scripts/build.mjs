import { build } from "esbuild";
import { mkdir, readFile, writeFile, cp } from "node:fs/promises";
import { createHash } from "node:crypto";
const pages = process.argv.includes("--pages");
const output = pages ? "pages-dist" : "dist";
const base = pages ? "/line-rangers-guildwar/" : "/";
await mkdir(output, { recursive: true });
await build({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  minify: true,
  outdir: `${output}/assets`,
  entryNames: "app",
  target: ["es2022"],
  define: { "process.env.NODE_ENV": '"production"', __API_ORIGIN__: JSON.stringify(pages ? "https://line-rangers-guildwar.eagerowl2.chatgpt.site" : ""), __BASE_PATH__: JSON.stringify(base) },
  sourcemap: false,
  legalComments: "eof",
});
let html = await readFile("src/index.html", "utf8");
for (const ext of ["js", "css"]) {
  const path = `/assets/app.${ext}`;
  const version = createHash("sha256").update(await readFile(`${output}${path}`)).digest("hex").slice(0, 12);
  html = html.replace(path, `${base}assets/app.${ext}?v=${version}`);
}
await writeFile(`${output}/index.html`, html);
if (pages) {
  await mkdir(`${output}/guild-tracker`, { recursive: true });
  await cp(`${output}/index.html`, `${output}/guild-tracker/index.html`);
  await writeFile(`${output}/.nojekyll`, "");
}
console.log(`Built ${output}/`);

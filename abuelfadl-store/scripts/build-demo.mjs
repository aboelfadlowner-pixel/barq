// Builds the demo: one self-contained HTML page with the real store and dashboard code, for sharing as a link
// (claude.ai Artifact) before a server exists. The API routes run inside the browser and the data is kept in
// the viewer's localStorage. Run: npm run build:demo  ->  demo/dist/abuelfadl-demo.html
import { build } from "esbuild";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const r = (...parts) => path.join(ROOT, ...parts);
const OUT = r("demo/dist/abuelfadl-demo.html");

// ---- public/ files as data URIs
const MIME = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const assets = {};
// Product photos come from demo/photos: 240 px copies of public/products, so the page stays light (the real site uses
// the full 480 px photos).
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    let full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (MIME[path.extname(name)]) {
      const key = "/" + path.relative(r("public"), full).split(path.sep).join("/");
      if (path.basename(dir) === "products") full = r("demo/photos", name);
      assets[key] = `data:${MIME[path.extname(name)]};base64,${readFileSync(full).toString("base64")}`;
    }
  }
})(r("public"));

const inlineUrls = (css) =>
  css.replace(/url\((["']?)(\/[^"')]+)\1\)/g, (match, _q, file) => (assets[file] ? `url("${assets[file]}")` : match));

// ---- stylesheets: the store CSS in globals.css order, and the dashboard CSS
const globals = readFileSync(r("src/app/globals.css"), "utf8");
const storeCss = [...globals.matchAll(/@import\s+"([^"]+)";/g)]
  .map(([, file]) => readFileSync(path.resolve(r("src/app"), file), "utf8"))
  .join("\n");
const adminCss = readFileSync(r("src/styles/admin.css"), "utf8");

// ---- script
const shim = (name) => r("demo/shims", name);
const nextShims = {
  "next/link": shim("next-link.tsx"),
  "next/navigation": shim("next-navigation.ts"),
  "next/server": shim("next-server.ts"),
  "next/headers": shim("next-headers.ts"),
  "next/cache": shim("next-cache.ts"),
};
const demoPlugin = {
  name: "demo",
  setup(b) {
    b.onResolve({ filter: /^next\// }, (args) => (nextShims[args.path] ? { path: nextShims[args.path] } : undefined));
    // Server modules that need a server get their browser versions.
    b.onResolve({ filter: /^@\/server\/auth$/ }, () => ({ path: r("demo/server/auth.ts") }));
    b.onResolve({ filter: /^@\/server\/storage$/ }, () => ({ path: r("demo/server/storage.ts") }));
    b.onResolve({ filter: /^\.\/db$/ }, (args) => (args.importer.startsWith(r("src/server")) ? { path: r("demo/server/db.ts") } : undefined));
    // Dashboard code reloads pages with window.location; route that through the in-memory router.
    b.onLoad({ filter: /src[\\/]features[\\/]admin[\\/].*\.tsx?$/ }, (args) => ({
      contents: readFileSync(args.path, "utf8").replaceAll("window.location.", "window.__demoLocation."),
      loader: args.path.endsWith("x") ? "tsx" : "ts",
    }));
  },
};

const result = await build({
  entryPoints: [r("demo/main.tsx")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  jsx: "automatic",
  tsconfig: r("tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [demoPlugin],
  logLevel: "warning",
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const demoCss = `
.demo-bar{position:fixed;z-index:9999;left:max(12px,env(safe-area-inset-left,0px));bottom:calc(112px + env(safe-area-inset-bottom,0px));display:flex;gap:6px;align-items:center;
  background:#1A211C;color:#fff;border-radius:999px;padding:5px 6px 5px 12px;font:500 12px/1.2 'Readex Pro',Tahoma,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.18);direction:rtl}
.demo-bar .demo-tag{opacity:.7;padding-inline:4px}
.demo-bar button{all:unset;cursor:pointer;background:#2B7A4B;color:#fff;border-radius:999px;padding:6px 12px;font:inherit}
.demo-bar button.warn{background:#C62828}
.demo-bar button:focus-visible{outline:2px solid #fff;outline-offset:2px}
@media(min-width:900px){.demo-bar{bottom:calc(16px + env(safe-area-inset-bottom,0px))}}`;

const html = `<title>أبو الفضل ستور تجريبي</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300..700&display=swap">
<style id="css-store">${inlineUrls(storeCss)}</style>
<style id="css-admin">${inlineUrls(adminCss)}</style>
<style id="css-demo">${demoCss}</style>
<script>(function(){var a=document.getElementById("css-admin").sheet,s=document.getElementById("css-store").sheet,adm=location.hash==="#admin";if(a)a.disabled=!adm;if(s)s.disabled=adm;})();</script>
<div id="root"></div>
<script>window.__ASSETS=${JSON.stringify(assets)};</script>
<script>${js}</script>
`;

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`demo/dist/abuelfadl-demo.html  ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);

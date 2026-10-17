// Verifies that the TypeScript data and services match the original v29 data exactly.
// Run: npm run verify:data
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const OUT = ".verify-tmp";
const V29 = "reference/v29/split-source/";
rmSync(OUT, { recursive: true, force: true });
writeFileSync("tsconfig.verify.json", JSON.stringify({
  compilerOptions: { target: "ES2022", module: "node16", moduleResolution: "node16", outDir: OUT, rootDir: "src", skipLibCheck: true, strict: true },
  files: ["src/services/mock/catalog.ts"],
}));
try { execSync("npx tsc -p tsconfig.verify.json", { stdio: "inherit" }); } finally { rmSync("tsconfig.verify.json", { force: true }); }

// ---- original v29 data, evaluated as the old page did
const ctx = {}; vm.createContext(ctx);
const read = (f) => readFileSync(V29 + f, "utf8");
// Photos that exist in v29, plus photos added after the migration (sandwiches, salads and fresh juices).
const EXTRA_PHOTOS = [13575, 13619, 13622, 13624, 13626, 13569, 13571, 13594, 13603, 35193, 52847, 52854, 52859, 52863, 52866, 52869, 52872, 52876, 52881, 52885, 52969, 52972];
const photoIds = new Set([...readdirSync(V29 + "assets/products").map((f) => +f.split(".")[0]), ...EXTRA_PHOTOS]);
vm.runInContext("(function(){" + read("js/data/categories.js") + read("js/data/products.js") + ";this.CATS=CATS;this.RAW=RAW}).call(globalThis)", ctx);
const normSrc = read("js/02-utils.js").match(/var norm=(.*);\s*\n/)[1];
const norm = vm.runInContext("(" + normSrc + ")", vm.createContext({}));

const require = createRequire(import.meta.url);
const { mockCatalogService: catalogService } = require("../" + OUT + "/services/mock/catalog.js");
const { normalizeArabic } = require("../" + OUT + "/lib/arabic.js");

let failures = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.error("FAIL:", msg); } };

const cats = await catalogService.getCategories();
ok(cats.length === ctx.CATS.length, `category count ${cats.length} vs ${ctx.CATS.length}`);
ctx.CATS.forEach((c, i) => ok(JSON.stringify(c) === JSON.stringify({ id: cats[i].id, name: cats[i].name, art: cats[i].art, tint: cats[i].tint }), `category ${c.id}`));

const prods = await catalogService.getProducts();
ok(prods.length === ctx.RAW.length, `product count ${prods.length} vs ${ctx.RAW.length}`);
ctx.RAW.forEach((r, i) => {
  const p = prods[i];
  ok(p.id === r[0] && p.categoryId === r[1] && p.name === r[2] && p.price === r[3], `core fields ${r[0]}`);
  ok(p.weighed === !!r[5] && p.weightStep === (r[5] ? 0.25 : undefined), `weight ${r[0]}`);
  ok(p.inStock === !r[6], `stock ${r[0]}`);
  ok(p.bestseller === !!r[7] && p.offer === !!r[8], `flags ${r[0]}`);
  ok(p.description === (r[9] || undefined), `description ${r[0]}`);
  ok(p.imageUrl === (photoIds.has(r[0]) ? `/products/${r[0]}.webp` : undefined), `image ${r[0]}`);
});
for (const id of photoIds) ok(readdirSync("public/products").includes(id + ".webp"), `photo file ${id}`);
ok(readdirSync("public/products").length === photoIds.size, "photo file count");

// services behaviour
ok((await catalogService.getProduct(13221))?.name === "سمنة فلاحي بقري", "getProduct");
ok((await catalogService.getProduct(-1)) === null, "getProduct unknown -> null");
ok((await catalogService.getCategory("dairy"))?.name === "ألبان", "getCategory");
ok((await catalogService.getCategory("nope")) === null, "getCategory unknown -> null");
ok((await catalogService.getProductsByIds([13221, -5, 13522])).length === 2, "getProductsByIds skips unknown");
for (const c of ctx.CATS) {
  const n = ctx.RAW.filter((r) => r[1] === c.id).length;
  ok((await catalogService.getProducts({ categoryId: c.id })).length === n, `category filter ${c.id}`);
}
// search must equal the v29 rule for a set of queries
const catName = Object.fromEntries(ctx.CATS.map((c) => [c.id, c.name]));
for (const q of ["سمنه", "سمنة", "جبنة", "جبنه رومي", "لبن", "عصير", "ألبان", "اجبان", "كيري", "xyz", "", "  ", "الأكثر"]) {
  const nq = norm(q);
  ok(normalizeArabic(q) === nq, `normalize "${q}"`);
  const expected = ctx.RAW.filter((r) => !nq || norm(r[2] + " " + catName[r[1]]).indexOf(nq) > -1).map((r) => r[0]);
  const got = (await catalogService.getProducts({ search: q })).map((p) => p.id);
  ok(JSON.stringify(got) === JSON.stringify(expected), `search "${q}" -> ${got.length} vs ${expected.length}`);
}
rmSync(OUT, { recursive: true, force: true });
console.log(`${checks} checks, ${failures} failed`);
console.log(`categories: ${cats.length}, products: ${prods.length}, with photo: ${prods.filter((p) => p.imageUrl).length}, weighed: ${prods.filter((p) => p.weighed).length}, unavailable: ${prods.filter((p) => !p.inStock).length}, bestseller: ${prods.filter((p) => p.bestseller).length}, offer flag: ${prods.filter((p) => p.offer).length}, with description: ${prods.filter((p) => p.description).length}`);
process.exit(failures ? 1 : 0);

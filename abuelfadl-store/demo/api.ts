// Runs the real API route files (src/app/api/**) inside the browser: fetch("/api/...") calls are answered here
// instead of by a server, so validation, prices and statuses follow exactly the same code as the real backend.
import * as categories from "../src/app/api/categories/route";
import * as products from "../src/app/api/products/route";
import * as product from "../src/app/api/products/[id]/route";
import * as orders from "../src/app/api/orders/route";
import * as login from "../src/app/api/admin/login/route";
import * as logout from "../src/app/api/admin/logout/route";
import * as stats from "../src/app/api/admin/stats/route";
import * as adminProducts from "../src/app/api/admin/products/route";
import * as adminProduct from "../src/app/api/admin/products/[id]/route";
import * as adminCategories from "../src/app/api/admin/categories/route";
import * as adminCategory from "../src/app/api/admin/categories/[id]/route";
import * as adminOrders from "../src/app/api/admin/orders/route";
import * as adminOrder from "../src/app/api/admin/orders/[id]/route";

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
type RouteModule = Partial<Record<"GET" | "POST" | "PATCH" | "DELETE", Handler>>;

const ROUTES: [RegExp, RouteModule][] = [
  [/^\/api\/categories$/, categories],
  [/^\/api\/products$/, products],
  [/^\/api\/products\/(?<id>[^/]+)$/, product],
  [/^\/api\/orders$/, orders],
  [/^\/api\/admin\/login$/, login],
  [/^\/api\/admin\/logout$/, logout],
  [/^\/api\/admin\/stats$/, stats],
  [/^\/api\/admin\/products$/, adminProducts],
  [/^\/api\/admin\/products\/(?<id>[^/]+)$/, adminProduct],
  [/^\/api\/admin\/categories$/, adminCategories],
  [/^\/api\/admin\/categories\/(?<id>[^/]+)$/, adminCategory],
  [/^\/api\/admin\/orders$/, adminOrders],
  [/^\/api\/admin\/orders\/(?<id>[^/]+)$/, adminOrder],
] as [RegExp, RouteModule][];

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function handle(url: URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase() as keyof RouteModule;
  for (const [pattern, mod] of ROUTES) {
    const match = url.pathname.match(pattern);
    if (!match) continue;
    const handler = mod[method];
    if (!handler) return json({ error: "Method not allowed" }, 405);
    const request = new Request(url, init);
    return handler(request, { params: Promise.resolve({ ...match.groups }) });
  }
  return json({ error: "غير موجود" }, 404);
}

/** Installs the in-browser API. Any other request goes to the network as usual. */
export function installApi() {
  const networkFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (raw.startsWith("/api/")) {
      // A short pause so loading states show the way they do against a real server.
      await new Promise((resolve) => setTimeout(resolve, 120));
      return handle(new URL(raw, "https://demo.invalid"), init);
    }
    return networkFetch(input, init);
  };
}

import { serverCatalogService } from "./server/catalog";
import type { CatalogService } from "./contracts";

/**
 * The single place that decides which catalog implementation the server-rendered pages use.
 * Server-side only: client components import `@/services/client` instead.
 * `mock/catalog.ts` (static v29 data) is kept for `npm run verify:data`.
 */
export const catalogService: CatalogService = serverCatalogService;

/** Dashboard settings (minimum order, notice strip, WhatsApp, orders paused) for the store layout. */
export { getSettings } from "../server/settings";

export type { CatalogService, OrderService } from "./contracts";

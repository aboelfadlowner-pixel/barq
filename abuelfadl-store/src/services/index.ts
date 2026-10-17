import { mockCatalogService } from "./mock/catalog";
import { mockOrderService } from "./mock/orders";
import type { CatalogService, OrderService } from "./contracts";

/**
 * The single place that decides which implementation the app uses.
 * Today both are mocks over static data. When a real backend exists, swap the right-hand side here only.
 */
export const catalogService: CatalogService = mockCatalogService;
export const orderService: OrderService = mockOrderService;

export type { CatalogService, OrderService } from "./contracts";

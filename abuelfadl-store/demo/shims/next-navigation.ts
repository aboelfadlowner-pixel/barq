import { useSyncExternalStore } from "react";

/**
 * In-memory router standing in for `next/navigation` in the demo build (the Artifact page has no server and no real URLs).
 * Holds the current path (with query and hash), notifies subscribers, and mimics Next's scroll behaviour.
 */
let current = "/";
const listeners = new Set<() => void>();

export function getPath() {
  return current;
}

export function navigate(to: string, { replace: _replace = false }: { replace?: boolean } = {}) {
  const [target, hash] = to.split("#");
  current = target || "/";
  listeners.forEach((listener) => listener());
  // Next scrolls to the top after a navigation, or to the #anchor when there is one.
  requestAnimationFrame(() => {
    const anchor = hash ? document.getElementById(hash) : null;
    if (anchor) anchor.scrollIntoView();
    else window.scrollTo(0, 0);
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function usePath() {
  return useSyncExternalStore(subscribe, getPath, getPath);
}

export function usePathname(): string {
  return usePath().split("?")[0];
}

export function useSearchParams(): URLSearchParams {
  const query = usePath().split("?")[1] ?? "";
  return new URLSearchParams(query);
}

/** Dynamic segments of the routes the app has: /category/[slug], /admin/orders/[id], /admin/products/[id]. */
export function paramsOf(pathname: string): Record<string, string> {
  const category = pathname.match(/^\/category\/([^/]+)$/);
  if (category) return { slug: decodeURIComponent(category[1]) };
  const item = pathname.match(/^\/admin\/(?:orders|products)\/([^/]+)$/);
  if (item && item[1] !== "new") return { id: decodeURIComponent(item[1]) };
  return {};
}

export function useParams<T = Record<string, string>>(): T {
  return paramsOf(usePathname()) as T;
}

const router = {
  push: (href: string) => navigate(href),
  replace: (href: string) => navigate(href, { replace: true }),
  back: () => navigate("/"),
  forward: () => {},
  refresh: () => navigate(current),
  prefetch: () => {},
};

export function useRouter() {
  return router;
}

export class NotFoundError extends Error {}

export function notFound(): never {
  throw new NotFoundError("not found");
}

export function redirect(href: string): never {
  navigate(href, { replace: true });
  throw new Error("redirect");
}

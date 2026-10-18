import { cookieJar } from "./cookie-jar";

/** `next/server` for the demo build: a Response with `json()` and the `cookies` helper the API routes use. */
export class NextResponse extends Response {
  cookies = {
    set: (name: string, value: string, options: { maxAge?: number } = {}) => cookieJar.set(name, value, options.maxAge),
    delete: (name: string) => cookieJar.delete(name),
  };

  static json(body: unknown, init: ResponseInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    return new NextResponse(JSON.stringify(body), { ...init, headers });
  }
}

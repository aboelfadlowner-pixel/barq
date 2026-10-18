import { cookieJar } from "./cookie-jar";

/** `next/headers` for the demo build. */
export async function cookies() {
  return {
    get(name: string) {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
  };
}

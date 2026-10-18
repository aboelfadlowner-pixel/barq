/** Cookies for the demo build (kept in localStorage instead of HTTP cookies). */
const KEY = "abuelfadl_demo_cookies";

type Jar = Record<string, { value: string; expires: number }>;

function load(): Jar {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Jar;
  } catch {
    return {};
  }
}

let jar: Jar = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(jar));
  } catch {
    // storage blocked: keep in memory
  }
}

export const cookieJar = {
  get(name: string): string | undefined {
    const entry = jar[name];
    if (!entry) return undefined;
    if (entry.expires && entry.expires < Date.now()) {
      delete jar[name];
      save();
      return undefined;
    }
    return entry.value;
  },
  set(name: string, value: string, maxAge?: number) {
    jar = { ...jar, [name]: { value, expires: maxAge ? Date.now() + maxAge * 1000 : 0 } };
    save();
  },
  delete(name: string) {
    const { [name]: _removed, ...rest } = jar;
    jar = rest;
    save();
  },
};

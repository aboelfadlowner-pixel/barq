import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getPath, navigate } from "./shims/next-navigation";
import { App } from "./App";
import { installApi } from "./api";

declare global {
  interface Window {
    __ASSETS: Record<string, string>;
  }
}

// Same attributes the store's root layout puts on <html>.
const root = document.documentElement;
root.lang = "ar";
root.dir = "rtl";
root.setAttribute("data-scroll-behavior", "smooth");
root.classList.add("js");

// Files from public/ are embedded in the page: map "/products/13221.webp" etc. to the embedded copy.
const resolveAsset = (value: string) => (value.startsWith("/") && window.__ASSETS[value.split("?")[0]]) || value;
const setAttribute = Element.prototype.setAttribute;
Element.prototype.setAttribute = function (name: string, value: string) {
  return setAttribute.call(this, name, name === "src" ? resolveAsset(String(value)) : value);
};
const imgSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src")!;
Object.defineProperty(HTMLImageElement.prototype, "src", {
  ...imgSrc,
  set(value: string) {
    imgSrc.set!.call(this, resolveAsset(String(value)));
  },
});

// The Artifact frame refuses confirm() dialogs; the demo has a "reset data" button instead.
window.confirm = () => true;

// Plain links inside the site (e.g. "فتح المتجر" in the dashboard) go through the in-memory router.
document.addEventListener("click", (event) => {
  const link = (event.target as Element | null)?.closest?.("a");
  const href = link?.getAttribute("href");
  if (!link || !href || event.defaultPrevented || !href.startsWith("/")) return;
  event.preventDefault();
  navigate(href);
});

// `window.location` replacement used by the dashboard code in this build (see scripts/build-demo.mjs).
(window as unknown as { __demoLocation: object }).__demoLocation = {
  set href(value: string) {
    navigate(value);
  },
  get pathname() {
    return getPath().split("?")[0];
  },
};

installApi();

// Opening the link with #admin starts on the dashboard.
if (location.hash === "#admin") navigate("/admin");

function Root() {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const reset = () => setGeneration((n) => n + 1);
    window.addEventListener("demo-reset", reset);
    return () => window.removeEventListener("demo-reset", reset);
  }, []);
  return <App key={generation} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

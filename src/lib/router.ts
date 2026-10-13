// A tiny History-API router: the app only has a handful of pages, so a
// router library would be overkill. The worker serves index.html for every
// non-API path, so deep links like /team work on refresh.
import { useEffect, useState } from "react";

const NAVIGATE_EVENT = "app:navigate";

export function navigate(to: string, { replace = false } = {}): void {
  if (to === window.location.pathname + window.location.search) return;
  if (replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", update);
    window.addEventListener(NAVIGATE_EVENT, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(NAVIGATE_EVENT, update);
    };
  }, []);

  return pathname;
}

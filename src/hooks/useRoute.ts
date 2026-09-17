import { useEffect, useState } from "react";

export type Route = "storefront" | "admin";

export const ADMIN_HASH = "#/admin";

function readRoute(): Route {
  return window.location.hash === ADMIN_HASH ? "admin" : "storefront";
}

/**
 * The hash, not a path: a deep link to the publishing page is then still a request for
 * `/`, so the ~30-line static server needs no SPA fallback rule to serve it. The tenant
 * stays in the query string, which the hash leaves untouched.
 */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return route;
}

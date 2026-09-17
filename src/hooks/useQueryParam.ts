import { useCallback, useEffect, useState } from "react";

function read(name: string): string | undefined {
  return new URLSearchParams(window.location.search).get(name) || undefined;
}

/**
 * One query parameter, kept in the url rather than in component state. What scopes a read
 * belongs in the address: it stays visible, it survives a reload, and the view is a
 * shareable link. The hash is left alone, so the publishing page's route rides alongside.
 */
export function useQueryParam(name: string) {
  const [value, setValue] = useState<string | undefined>(() => read(name));

  useEffect(() => {
    const sync = () => setValue(read(name));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [name]);

  const write = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      const params = new URLSearchParams(window.location.search);
      if (trimmed) params.set(name, trimmed);
      else params.delete(name);

      const query = params.toString();
      window.history.pushState(
        {},
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
      setValue(trimmed || undefined);
    },
    [name],
  );

  return [value, write] as const;
}

import { useState, useEffect } from "react";

export function useIsMobile(breakpoint = 640) {
  const mq = `(max-width: ${breakpoint - 1}px)`;
  const [isMobile, set] = useState(() => matchMedia(mq).matches);

  useEffect(() => {
    const mql = matchMedia(mq);
    const onChange = (e: MediaQueryListEvent) => set(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mq]);

  return isMobile;
}

"use client";

import type { ReactNode } from "react";

// Render navigation as a sibling of the app shell so fixed overlays always use
// the browser viewport as their containing block (including Safari on iPad).
export function ViewportNavigation({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

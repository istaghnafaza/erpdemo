import { createPortal } from "react-dom";
import type { ReactNode } from "react";

/** Render print-only markup on document.body so dialog transform/overflow cannot clip it. */
export function PrintPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

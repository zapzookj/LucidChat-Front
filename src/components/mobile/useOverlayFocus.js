import { useEffect, useRef } from "react";

// Shared by the mobile sheet and drawer. Only the most recently opened primitive
// handles Escape / Tab, so a nested sheet cannot dismiss the drawer behind it.
const openOverlays = [];
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export default function useOverlayFocus(open, panelRef, onClose, { trapFocus = true } = {}) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return undefined;
    const panel = panelRef.current;
    const previous = document.activeElement;
    const entry = { panel };
    openOverlays.push(entry);
    const focusable = () => [...panel.querySelectorAll(FOCUSABLE)]
      .filter((node) => node.getClientRects().length > 0 && !node.closest('[inert], [aria-hidden="true"]'));
    // Focus the sheet itself first: opening a settings sheet must not summon the
    // phone keyboard merely because its first control happens to be an input.
    panel.focus({ preventScroll: true });
    const handleKeyDown = (event) => {
      if (openOverlays.at(-1) !== entry) return;
      // Another (non-primitive) modal may be stacked above this surface.
      const activeDialog = document.activeElement?.closest('[role="dialog"]');
      if (activeDialog && activeDialog !== panel && !panel.contains(activeDialog)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current?.();
      }
      if (event.key !== "Tab" || !trapFocus) return;
      const nodes = focusable();
      const first = nodes[0];
      const last = nodes.at(-1);
      if (!first) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      const index = openOverlays.indexOf(entry);
      if (index !== -1) openOverlays.splice(index, 1);
      document.removeEventListener("keydown", handleKeyDown);
      if (previous?.isConnected && (panel.contains(document.activeElement) || document.activeElement === document.body)) {
        previous.focus?.({ preventScroll: true });
      }
    };
  }, [open, panelRef, trapFocus]);
}

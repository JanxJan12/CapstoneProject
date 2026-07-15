import { useEffect, type RefObject } from "react";

const EDITABLE_ELEMENTS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function useSearchShortcut(
  searchRef: RefObject<HTMLInputElement | null>,
  key = "/",
) {
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const editing =
        EDITABLE_ELEMENTS.has(target.tagName) || target.isContentEditable;
      if (event.key === key && !editing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [key, searchRef]);
}

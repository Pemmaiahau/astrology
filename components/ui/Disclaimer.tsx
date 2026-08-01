"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "jyotisha.disclaimer.dismissed";

/**
 * Global dismissible disclaimer. Dismissal persists in localStorage.
 * Rendered after mount only, so server/client markup always match.
 */
export default function Disclaimer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="border-b border-heading-border bg-primary-wash">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2">
        <p className="flex-1 text-xs leading-relaxed text-heading-2">
          Readings here are for guidance and self-reflection. They describe classical astrological
          combinations, not certainties — and they are not medical, legal or financial advice.
        </p>
        <button
          type="button"
          aria-label="Dismiss disclaimer"
          onClick={() => {
            setVisible(false);
            try {
              localStorage.setItem(STORAGE_KEY, "1");
            } catch {
              /* storage unavailable — dismiss for this session only */
            }
          }}
          className="mt-0.5 shrink-0 rounded p-0.5 text-primary-faint transition hover:bg-primary-wash-2 hover:text-heading"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

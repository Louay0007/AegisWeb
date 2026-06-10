"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";

const STORAGE_KEY = "aegisweb-cookie-consent";

export function ConsentAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    function updateConsent() {
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === "accepted");
    }

    updateConsent();
    window.addEventListener("storage", updateConsent);
    window.addEventListener("aegisweb-cookie-consent", updateConsent);
    return () => {
      window.removeEventListener("storage", updateConsent);
      window.removeEventListener("aegisweb-cookie-consent", updateConsent);
    };
  }, []);

  return enabled ? <Analytics /> : null;
}

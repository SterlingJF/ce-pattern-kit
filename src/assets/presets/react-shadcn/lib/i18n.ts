import { createInstance } from "i18next";
import { useTranslation } from "react-i18next";

import en from "../copy/en.json" with { type: "json" };

// Rule 9: every user-facing text comes from copy/. The base language types t(), so a key that
// isn't in copy/en.json fails the type-check.
declare module "i18next" {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}

// The library's own instance, never the global one another package may own. The catalogue loads
// inline, so the instance is ready on import.
export const copy = createInstance();
void copy.init({
  lng: "en",
  fallbackLng: "en",
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
  initAsync: false,
});

// For code outside React.
export const t = copy.t;

// For components: re-renders when the language changes.
export function useCopy() {
  return useTranslation(undefined, { i18n: copy }).t;
}

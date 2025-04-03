import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import translations
import enTranslation from "../locales/en.json";
import frTranslation from "../locales/fr.json";

// Configure i18n
i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Bind react-i18next to the instance
  .init({
    resources: {
      en: {
        translation: enTranslation
      },
      fr: {
        translation: frTranslation
      }
    },
    fallbackLng: "en",
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"]
    },
    interpolation: {
      escapeValue: false // React already protects from XSS
    }
  });

export default i18n;

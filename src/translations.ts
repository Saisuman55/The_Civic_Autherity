import { en } from './locales/en';
import { hi } from './locales/hi';
import { or } from './locales/or';
import { Language, Translations } from './i18n-types';

const allKeys = Array.from(new Set([
  ...Object.keys(en),
  ...Object.keys(hi),
  ...Object.keys(or)
]));

export const translations: Translations = {};

allKeys.forEach(key => {
  translations[key] = {
    en: (en as any)[key] || key,
    hi: (hi as any)[key] || key,
    or: (or as any)[key] || key
  };
});

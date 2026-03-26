export type Language = 'en' | 'hi' | 'or';

export interface Translations {
  [key: string]: {
    [lang in Language]: string;
  };
}

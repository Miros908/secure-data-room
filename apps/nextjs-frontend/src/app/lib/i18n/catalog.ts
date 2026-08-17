import { en, type Messages } from './en';
import { ru } from './ru';
import { uk } from './uk';
import type { Locale } from './locale';

export type { Messages };

export const catalog: Record<Locale, Messages> = {
  en,
  ru,
  uk,
};

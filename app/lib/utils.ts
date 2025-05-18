import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function ordinal(n: number) {
  const s = ["th","st","nd","rd"];
  const v = n%100;
  return n+(s[(v-20)%10]||s[v]||s[0]);
}

// Map a value if it's not null or undefined, or an empty array
export function mapMaybe<T, U>(value: T | null | undefined, mapF: (value: T) => U): U | null {
  if (value == null) { return null }
  if (value instanceof Array && value.length == 0) {
    return null
  }
  return mapF(value);
}

export function trim(value: string): string {
  return value.trim();
}

export function nullifyTrim(value: string | null): string | null {
  const v = value?.trim();
  if (v == null || v == "") { return null }
  return v;
}

export function nullifyParseInt(value: string): number | null {
  const t = nullifyTrim(value);
  if (t == null) { return null }
  const v = parseInt(t, 10);
  if (isNaN(v)) { return null }
  return v;
}

export function ifNotZero<U>(value: number | null | undefined, mapF: (value: number) => U): U | null {
  if (value == null || value <= 0) { return null }
  return mapF(value);
}

export function groupBy<T, K extends keyof any>(arr: T[], keyFn: (t: T) => K): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = [...(acc[key] || []), item];
    return acc;
  }, {} as Record<K, T[]>);
}

export function groupByAndSort<T, K extends keyof any>(arr: T[], keyFn: (t: T) => K, sortFn: (a: T[], b: T[]) => number): Array<Array<T>> {
  const map = arr.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = [...(acc[key] || []), item];
    return acc;
  }, {} as Record<K, T[]>);
  const asArray = Object.values(map) as Array<Array<T>>;
  return asArray.sort((x, y) => sortFn(x, y));
}

export function toMap<T, K extends keyof any>(arr: T[], keyFn: (t: T) => K): Record<K, T> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = item;
    return acc;
  }, {} as Record<K, T>);
}

export function formatOrdinal(n: number): string {
  const s = ["th","st","nd","rd"];
  const v = n%100;
  return n+(s[(v-20)%10]||s[v]||s[0]);
}
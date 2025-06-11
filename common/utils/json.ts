/**
 * Recursively sorts the keys of a JSON object alphabetically
 * @param obj - The object to sort keys for
 * @returns A new object with sorted keys (does not mutate the original)
 */
export function sortJsonKeysAlphabetically<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sortJsonKeysAlphabetically(item)) as T;
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const sortedObj: Record<string, any> = {};
    const keys = Object.keys(obj as Record<string, any>).sort();
    
    for (const key of keys) {
      sortedObj[key] = sortJsonKeysAlphabetically((obj as Record<string, any>)[key]);
    }
    
    return sortedObj as T;
  }

  // For primitives, return as-is
  return obj;
}

export function sortJsonKeysAlphabeticallyNonRecursive<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj;
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const sortedObj: Record<string, any> = {};
    const keys = Object.keys(obj as Record<string, any>).sort();
    
    for (const key of keys) {
      sortedObj[key] = (obj as Record<string, any>)[key];
    }
    
    return sortedObj as T;
  }

  // For primitives, return as-is
  return obj;
}
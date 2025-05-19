
// Gets the family ID from a card reference, e.g.:
// ALT_CORE_BR_24_C -> BR_24
export function getFamilyIdFromRef(ref: string): string {
  const match = ref.match(/_((AX|BR|LY|MU|OR|YZ|NE)_(\d{2}))_/i)
  if (!match) {
    throw new Error(`Invalid ref: ${ref}`);
  }
  return match[1];
}
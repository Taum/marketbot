// This is the character data stored in the database (characterData column)
export interface PartCharacterData {
  partId: number
  startIndex: number
  endIndex: number
  substituteText?: string
}
export interface AbilityCharacterDataV1 {
  version: 1
  lineStartIndex: number
  lineEndIndex: number
  lineStartIndexFr: number
  lineEndIndexFr: number
  parts: PartCharacterData[]
  partsFr: PartCharacterData[]
}

export interface ThrottlingConfig {
  maxOperationsPerWindow: number;
  windowMs: number;
}

export const throttlingConfig: { [key: string]: ThrottlingConfig } = {
  "market": {
    maxOperationsPerWindow: 1,
    windowMs: 2000,
  },
  "uniques": {
    maxOperationsPerWindow: 5,
    windowMs: 5000,
  },
}

export interface ThrottlingConfig {
  maxOperationsPerWindow: number;
  windowMs: number;
  evenlySpaced?: boolean;
}

export const throttlingConfig: { [key: string]: ThrottlingConfig } = {
  "market": {
    maxOperationsPerWindow: 20,
    windowMs: 10000,
    evenlySpaced: true,
  },
  "uniques": {
    maxOperationsPerWindow: 20,
    windowMs: 15000,
    evenlySpaced: false,
  },
}
import { getEnv } from "./helpers";

export interface ThrottlingConfig {
  maxOperationsPerWindow: number;
  windowMs: number;
  evenlySpaced?: boolean;
}

const throttleConfigStr = getEnv("THROTTLE_CONFIG") ?? "market:10:10000:true;uniques:20:20000:false"

export const throttlingConfig: { [key: string]: ThrottlingConfig } = throttleConfigStr.split(";").reduce((acc, curr) => {
  const [key, maxOperationsPerWindow, windowMs, evenlySpaced] = curr.split(":")
  acc[key] = {
    maxOperationsPerWindow: parseInt(maxOperationsPerWindow),
    windowMs: parseInt(windowMs),
    evenlySpaced: evenlySpaced === "true",
  }
  return acc
}, {} as { [key: string]: ThrottlingConfig })
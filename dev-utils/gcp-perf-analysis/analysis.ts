import * as fs from 'fs';
import * as path from 'path';

interface LogEntry {
  id: string;
  timestamp: string;
  severity: string;
  type: string;
  log_name: string;
  text_payload: string;
}

interface ParsedRequest {
  url: string;
  queryParams: Record<string, string>;
  duration: number;
  originalPayload: string;
}

interface DurationStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p90: number;
  p95: number;
  p99: number;
}

const IGNORED_PARAMS = ['fbclid'];

function parseQueryParams(url: string): Record<string, string> {
  const urlObj = new URL(url, 'http://localhost');
  const params: Record<string, string> = {};

  for (const [key, value] of urlObj.searchParams.entries()) {
    if (value.length > 0 && !IGNORED_PARAMS.includes(key)) {
      params[key] = value;
    }
  }
  
  return params;
}

function extractDuration(textPayload: string): number | null {
  // Match duration pattern: number followed by "ms" at the end
  const durationMatch = textPayload.match(/(\d+\.?\d*)\s*ms$/);
  if (durationMatch) {
    return parseFloat(durationMatch[1]);
  }
  return null;
}

function extractUrl(textPayload: string): string | null {
  // Match GET request pattern: GET /path?params
  const urlMatch = textPayload.match(/GET\s+([^\s]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  return null;
}

function hasQueryParams(url: string): boolean {
  return url.includes('?');
}

function parseLogEntry(entry: LogEntry): ParsedRequest | null {
  const url = extractUrl(entry.text_payload);
  if (!url || !hasQueryParams(url)) {
    return null;
  }

  const duration = extractDuration(entry.text_payload);
  if (duration === null) {
    return null;
  }

  const queryParams = parseQueryParams(url);
  if (Object.keys(queryParams).length === 0) {
    return null;
  }

  return {
    url,
    queryParams,
    duration,
    originalPayload: entry.text_payload
  };
}

function calculatePercentile(sortedValues: number[], percentile: number): number {
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

function calculateStats(durations: number[]): DurationStats {
  const sorted = [...durations].sort((a, b) => a - b);
  const count = sorted.length;
  const min = sorted[0];
  const max = sorted[count - 1];
  const mean = sorted.reduce((sum, val) => sum + val, 0) / count;
  const median = calculatePercentile(sorted, 50);
  const p90 = calculatePercentile(sorted, 90);
  const p95 = calculatePercentile(sorted, 95);
  const p99 = calculatePercentile(sorted, 99);

  return {
    count,
    min,
    max,
    mean,
    median,
    p90,
    p95,
    p99
  };
}

function formatDuration(ms: number): string {
  // if (ms < 1000) {
  //   return `${ms.toFixed(2)}ms`;
  // } else {
  //   return `${(ms / 1000).toFixed(2)}s`;
  // }
  return `${ms.toFixed(0)}ms`;
}

function formatQueryParams(queryParams: Record<string, string>): string {
  return Object.entries(queryParams)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
}

async function main() {
  const logFilePath = path.join('dev-utils', 'gcp-perf-analysis', 'downloaded-logs-20250623-121624.json');
  
  console.log('Reading log file...');
  const rawData = fs.readFileSync(logFilePath, 'utf-8');
  const logs: LogEntry[] = JSON.parse(rawData);
  
  console.log(`Total log entries: ${logs.length}`);
  
  // Parse and filter entries
  const parsedRequests: ParsedRequest[] = [];
  
  for (const entry of logs) {
    const parsed = parseLogEntry(entry);
    if (parsed) {
      parsedRequests.push(parsed);
    }
  }
  
  console.log(`Entries with query parameters and duration: ${parsedRequests.length}`);
  
  // Sort by duration (ascending)
  const sortedByDuration = [...parsedRequests].sort((a, b) => a.duration - b.duration);
  
  // Calculate statistics
  const durations = parsedRequests.map(req => req.duration);
  const stats = calculateStats(durations);
  
  // Display results
  console.log('\n=== PERFORMANCE STATISTICS ===');
  console.log(`Total requests analyzed: ${stats.count}`);
  console.log(`Duration range: ${formatDuration(stats.min)} - ${formatDuration(stats.max)}`);
  console.log(`Mean duration: ${formatDuration(stats.mean)}`);
  console.log(`Median (P50): ${formatDuration(stats.median)}`);
  console.log(`P90: ${formatDuration(stats.p90)}`);
  console.log(`P95: ${formatDuration(stats.p95)}`);
  console.log(`P99: ${formatDuration(stats.p99)}`);
  
  // Show slowest requests
  console.log('\n=== SLOWEST 10 REQUESTS ===');
  const slowest = sortedByDuration.slice(-10).reverse();
  slowest.forEach((req, index) => {

    console.log(`${index + 1}. ${formatDuration(req.duration)} - ${formatQueryParams(req.queryParams)} ${req.url}`);
  });
  
  // Show fastest requests
  console.log('\n=== FASTEST 10 REQUESTS ===');
  const fastest = sortedByDuration.slice(0, 10);
  fastest.forEach((req, index) => {
    console.log(`${index + 1}. ${formatDuration(req.duration)} - ${formatQueryParams(req.queryParams)} ${req.url}`);
  });
  
  // Analyze query parameter patterns
  console.log('\n=== QUERY PARAMETER ANALYSIS ===');
  const paramCounts: Record<string, number> = {};
  
  for (const req of parsedRequests) {
    for (const param of Object.keys(req.queryParams)) {
      paramCounts[param] = (paramCounts[param] || 0) + 1;
    }
  }
  
  const sortedParams = Object.entries(paramCounts)
    .sort(([,a], [,b]) => b - a);
  
  console.log('Most common query parameters:');
  sortedParams.slice(0, 10).forEach(([param, count]) => {
    console.log(`  ${param}: ${count} requests (${Math.round(count / parsedRequests.length * 100)}%)`);
  });
}

await main();
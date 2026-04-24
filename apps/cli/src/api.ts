import axios, { AxiosError } from 'axios';
import chalk from 'chalk';

export const API_BASE = process.env.CRAWLX_API_URL || 'http://localhost:3002';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

export function formatAxiosError(error: unknown): never {
  if (error instanceof AxiosError) {
    const detail = error.response?.data
      ? typeof error.response.data === 'string'
        ? error.response.data
        : JSON.stringify(error.response.data, null, 2)
      : error.message;
    console.error(chalk.red(`API error: ${detail}`));
    process.exit(1);
  }
  if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
  console.error(chalk.red(`Unknown error`));
  process.exit(1);
}

export async function apiGet<T>(path: string): Promise<T> {
  try {
    const response = await axios.get<T>(`${API_BASE}${path}`);
    return response.data;
  } catch (error) {
    formatAxiosError(error);
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  try {
    const response = await axios.post<T>(`${API_BASE}${path}`, body);
    return response.data;
  } catch (error) {
    formatAxiosError(error);
  }
}

export interface JobStatus {
  jobId: string;
  state: string;
  progress?: number;
  total?: number;
  error?: string;
  artifacts?: Record<string, unknown>;
}

export async function pollJobStatus(
  jobId: string,
  intervalMs = 2000,
  maxAttempts = 60,
): Promise<JobStatus> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await apiGet<JobStatus>(`/v2/crawlx/status/${jobId}`);

    if (status.state === 'COMPLETED' || status.state === 'completed') {
      return status;
    }

    if (status.state === 'FAILED' || status.state === 'failed') {
      throw new ApiError(500, status.error || `Job ${jobId} failed`);
    }

    const progress = status.progress != null && status.total != null
      ? chalk.gray(` [${status.progress}/${status.total}]`)
      : '';
    process.stdout.write(chalk.gray(`  ${status.state}${progress}...\n`));

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new ApiError(408, `Job ${jobId} did not complete within ${maxAttempts * intervalMs / 1000}s`);
}
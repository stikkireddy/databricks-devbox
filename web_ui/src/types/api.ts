export interface ServerConfig {
  name: string;
  workspace_path: string;
  extensions: string[];
}

export interface ServerResponse {
  id: string;
  name: string;
  port: number;
  workspace_path: string;
  status: string;
  pid?: number;
  uptime?: number;
  cpu_percent?: number;
  memory_mb?: number;
}

export interface HealthInfo {
  uptime?: number;
  cpu_percent?: number;
  memory_mb?: number;
}

export interface ApiResponse<T = any> {
  status: string;
  message?: string;
  data?: T;
}

export interface ApiError {
  detail: string;
}

export type ServerStatus = 'running' | 'stopped' | 'starting' | 'failed';
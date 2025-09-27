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

// Configuration types
export interface ExtensionGroup {
  name: string;
  description: string;
  extensions: string[];
  user_settings?: Record<string, any>;
}

export interface PortRange {
  start: number;
  end: number;
}

export interface ServerConfig {
  default_port: number;
  code_server_port_range: PortRange;
}

export interface UISettings {
  auto_refresh_interval: number;
  show_advanced_options: boolean;
  enable_dark_mode: boolean;
}

export interface WorkspaceConfig {
  default_type: string;
  max_upload_size_mb: number;
  supported_archive_types: string[];
}

export interface UIConfig {
  default_extension_groups: string[];
  settings: UISettings;
  workspace: WorkspaceConfig;
}

export interface DevboxConfig {
  extension_groups: Record<string, ExtensionGroup>;
  server: ServerConfig;
  ui: UIConfig;
}

export interface ConfigResponse {
  status: string;
  data: DevboxConfig;
}
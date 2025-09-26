import type { ServerConfig, ServerResponse, HealthInfo, ApiResponse, ApiError } from '../types/api';

const API_BASE_URL = '';  // Relative path for same-origin requests

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData: ApiError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`
        }));
        throw new Error(errorData.detail);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  }

  // Server management endpoints
  async listServers(): Promise<ServerResponse[]> {
    return this.request<ServerResponse[]>('/servers');
  }

  async createServer(config: ServerConfig): Promise<ServerResponse> {
    return this.request<ServerResponse>('/servers', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async createServerWithWorkspace(
    name: string,
    extensions: string[],
    zipFile?: File,
    githubUrl?: string
  ): Promise<ServerResponse> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('extensions', JSON.stringify(extensions));

    if (zipFile) {
      formData.append('zip_file', zipFile);
    }

    if (githubUrl) {
      formData.append('github_url', githubUrl);
    }

    const url = `${API_BASE_URL}/servers/create-with-workspace`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`
        }));
        throw new Error(errorData.detail);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  }

  async startServer(serverId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/servers/${serverId}/start`, {
      method: 'POST',
    });
  }

  async stopServer(serverId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/servers/${serverId}/stop`, {
      method: 'POST',
    });
  }

  async restartServer(serverId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/servers/${serverId}/restart`, {
      method: 'POST',
    });
  }

  async deleteServer(serverId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/servers/${serverId}`, {
      method: 'DELETE',
    });
  }

  async getServerHealth(serverId: string): Promise<{ status: string; data: HealthInfo }> {
    return this.request<{ status: string; data: HealthInfo }>(`/servers/${serverId}/health`);
  }

  async healthCheck(): Promise<{ status: string; service: string }> {
    return this.request<{ status: string; service: string }>('/health');
  }

  // Status refresh endpoints
  async refreshServerStatus(serverId: string): Promise<{
    status: string;
    id: string;
    old_status: string;
    new_status: string;
    updated: boolean;
  }> {
    return this.request<{
      status: string;
      id: string;
      old_status: string;
      new_status: string;
      updated: boolean;
    }>(`/servers/${serverId}/refresh-status`, {
      method: 'POST',
    });
  }

  async refreshAllServersStatus(): Promise<{
    status: string;
    total_servers: number;
    updated: number;
    message: string;
  }> {
    return this.request<{
      status: string;
      total_servers: number;
      updated: number;
      message: string;
    }>('/servers/refresh-all', {
      method: 'POST',
    });
  }

  // Multi-step server creation endpoints
  async createServerMetadata(name: string): Promise<ServerResponse> {
    return this.request<ServerResponse>('/servers/create-metadata', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async installServerExtensions(serverId: string, extensions: string[]): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/servers/${serverId}/install-extensions`, {
      method: 'POST',
      body: JSON.stringify({ extensions }),
    });
  }

  async cloneServerWorkspace(
    serverId: string,
    zipFile?: File,
    githubUrl?: string
  ): Promise<ApiResponse> {
    const formData = new FormData();

    if (zipFile) {
      formData.append('zip_file', zipFile);
    }

    if (githubUrl) {
      formData.append('github_url', githubUrl);
    }

    const url = `${API_BASE_URL}/servers/${serverId}/clone-workspace`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`
        }));
        throw new Error(errorData.detail);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import type { DevboxConfig, ExtensionGroup } from '@/types/api';

// Query keys for consistent cache management
export const configKeys = {
  all: ['config'] as const,
  config: () => [...configKeys.all, 'data'] as const,
  extensionGroups: () => [...configKeys.all, 'extension-groups'] as const,
};

// Default fallback extension groups (matching hardcoded ones in CreateServerDialog)
const DEFAULT_EXTENSION_GROUPS: Record<string, ExtensionGroup> = {
  python: {
    name: 'Python',
    description: 'Python development tools and language support',
    extensions: ['ms-python.python', 'ms-pyright.pyright']
  },
  jupyter: {
    name: 'Jupyter',
    description: 'Jupyter notebook support and tools',
    extensions: [
      'ms-toolsai.jupyter',
      'ms-toolsai.jupyter-renderers',
      'ms-toolsai.jupyter-keymap',
      'ms-toolsai.vscode-jupyter-cell-tags'
    ]
  },
  databricks: {
    name: 'Databricks',
    description: 'Databricks platform integration and SQL tools',
    extensions: [
      'databricks.databricks',
      'databricks.sqltools-databricks-driver'
    ]
  },
  'api-explorer': {
    name: 'API Explorer',
    description: 'REST API testing and exploration tools',
    extensions: ['rangav.vscode-thunder-client']
  }
};

// Hook to fetch the complete configuration
export const useConfig = () => {
  return useQuery({
    queryKey: configKeys.config(),
    queryFn: async () => {
      try {
        const response = await apiService.getConfig();
        return response.data;
      } catch (error) {
        console.warn('Failed to fetch config from API, using defaults:', error);
        // Return default config structure if API fails
        return {
          extension_groups: DEFAULT_EXTENSION_GROUPS,
          server: {
            default_port: 8000,
            code_server_port_range: { start: 8010, end: 8100 }
          },
          ui: {
            default_extension_groups: ['python', 'jupyter'],
            settings: {
              auto_refresh_interval: 5000,
              show_advanced_options: false,
              enable_dark_mode: true
            },
            workspace: {
              default_type: 'empty',
              max_upload_size_mb: 100,
              supported_archive_types: ['.zip', '.tar.gz']
            }
          }
        } as DevboxConfig;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false, // Don't retry on failure, fall back to defaults
  });
};

// Hook specifically for extension groups (commonly used)
export const useExtensionGroups = () => {
  const { data: config, isLoading, error } = useConfig();

  return {
    extensionGroups: config?.extension_groups || DEFAULT_EXTENSION_GROUPS,
    isLoading,
    error,
    // Helper to get default extension groups for UI
    defaultGroups: config?.ui?.default_extension_groups || ['python', 'jupyter'],
  };
};

// Hook for UI-specific configuration
export const useUIConfig = () => {
  const { data: config, isLoading, error } = useConfig();

  return {
    uiConfig: config?.ui || {
      default_extension_groups: ['python', 'jupyter'],
      settings: {
        auto_refresh_interval: 5000,
        show_advanced_options: false,
        enable_dark_mode: true
      },
      workspace: {
        default_type: 'empty',
        max_upload_size_mb: 100,
        supported_archive_types: ['.zip', '.tar.gz']
      }
    },
    isLoading,
    error,
  };
};

// Hook for server configuration
export const useServerConfig = () => {
  const { data: config, isLoading, error } = useConfig();

  return {
    serverConfig: config?.server || {
      default_port: 8000,
      code_server_port_range: { start: 8010, end: 8100 }
    },
    isLoading,
    error,
  };
};
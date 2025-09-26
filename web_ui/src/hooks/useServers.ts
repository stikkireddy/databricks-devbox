import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import type { ServerConfig } from '@/types/api';

// Add minimum delay to prevent flickering on fast API calls
const withMinDelay = async <T>(promise: Promise<T>, minDelay = 300): Promise<T> => {
  const [result] = await Promise.all([
    promise,
    new Promise(resolve => setTimeout(resolve, minDelay))
  ]);
  return result;
};

// Query keys for consistent cache management
export const serverKeys = {
  all: ['servers'] as const,
  lists: () => [...serverKeys.all, 'list'] as const,
  list: (filters: any) => [...serverKeys.lists(), { filters }] as const,
  details: () => [...serverKeys.all, 'detail'] as const,
  detail: (id: string) => [...serverKeys.details(), id] as const,
  health: (id: string) => [...serverKeys.all, 'health', id] as const,
};

// Fetch all servers
export const useServers = () => {
  return useQuery({
    queryKey: serverKeys.lists(),
    queryFn: () => apiService.listServers(),
    refetchInterval: 5000, // Poll every 5 seconds for updates
  });
};

// Fetch server health
export const useServerHealth = (serverId: string) => {
  return useQuery({
    queryKey: serverKeys.health(serverId),
    queryFn: () => apiService.getServerHealth(serverId),
    refetchInterval: 3000, // More frequent updates for health
    enabled: !!serverId,
  });
};

// Create server mutation
export const useCreateServer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: ServerConfig) => withMinDelay(apiService.createServer(config)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
      toast.success(`Server "${data.name}" created successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create server: ${error.message}`);
    },
  });
};

// Create server with workspace initialization mutation
export const useCreateServerWithWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      extensions,
      zipFile,
      githubUrl
    }: {
      name: string;
      extensions: string[];
      zipFile?: File;
      githubUrl?: string;
    }) => withMinDelay(apiService.createServerWithWorkspace(name, extensions, zipFile, githubUrl), 500),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
      toast.success(`Server "${data.name}" created successfully with workspace initialization`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create server: ${error.message}`);
    },
  });
};

// Start server mutation
export const useStartServer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serverId: string) => withMinDelay(apiService.startServer(serverId)),
    onSuccess: (_, serverId) => {
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serverKeys.health(serverId) });
      toast.success('Server started successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to start server: ${error.message}`);
    },
  });
};

// Stop server mutation
export const useStopServer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serverId: string) => withMinDelay(apiService.stopServer(serverId)),
    onSuccess: (_, serverId) => {
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serverKeys.health(serverId) });
      toast.success('Server stopped successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to stop server: ${error.message}`);
    },
  });
};

// Restart server mutation
export const useRestartServer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serverId: string) => withMinDelay(apiService.restartServer(serverId)),
    onSuccess: (_, serverId) => {
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serverKeys.health(serverId) });
      toast.success('Server restarted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to restart server: ${error.message}`);
    },
  });
};

// Delete server mutation
export const useDeleteServer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serverId: string) => withMinDelay(apiService.deleteServer(serverId)),
    onSuccess: (_, serverId) => {
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
      queryClient.removeQueries({ queryKey: serverKeys.health(serverId) });
      toast.success('Server deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete server: ${error.message}`);
    },
  });
};

// Multi-step server creation hooks
export const useCreateServerMetadata = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => withMinDelay(apiService.createServerMetadata(name)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create server metadata: ${error.message}`);
    },
  });
};

export const useInstallServerExtensions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serverId, extensions }: { serverId: string; extensions: string[] }) =>
      withMinDelay(apiService.installServerExtensions(serverId, extensions)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to install extensions: ${error.message}`);
    },
  });
};

export const useCloneServerWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serverId, zipFile, githubUrl }: { serverId: string; zipFile?: File; githubUrl?: string }) =>
      withMinDelay(apiService.cloneServerWorkspace(serverId, zipFile, githubUrl)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to initialize workspace: ${error.message}`);
    },
  });
};

// Multi-step server creation orchestrator hook
export const useMultiStepServerCreation = () => {
  const queryClient = useQueryClient();
  const createMetadata = useCreateServerMetadata();
  const installExtensions = useInstallServerExtensions();
  const cloneWorkspace = useCloneServerWorkspace();

  const createServerMultiStep = async (
    name: string,
    extensions: string[],
    zipFile?: File,
    githubUrl?: string,
    onProgress?: (step: string, current: number, total: number) => void
  ) => {
    let totalSteps = 1; // Always create metadata
    if (extensions.length > 0) totalSteps++;
    if (zipFile || githubUrl) totalSteps++;

    let currentStep = 0;

    try {
      // Step 1: Create server metadata
      currentStep++;
      onProgress?.('Creating server metadata...', currentStep, totalSteps);
      const server = await createMetadata.mutateAsync(name);

      // Step 2: Install extensions (if any)
      if (extensions.length > 0) {
        currentStep++;
        onProgress?.('Installing extensions...', currentStep, totalSteps);
        await installExtensions.mutateAsync({ serverId: server.id, extensions });
      }

      // Step 3: Clone workspace (if zipFile or githubUrl provided)
      if (zipFile || githubUrl) {
        currentStep++;
        onProgress?.(
          zipFile ? 'Extracting workspace...' : 'Cloning repository...',
          currentStep,
          totalSteps
        );
        await cloneWorkspace.mutateAsync({ serverId: server.id, zipFile, githubUrl });
      }

      // Final success
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
      toast.success(`Server "${server.name}" created successfully`);
      return server;
    } catch (error) {
      if (error instanceof Error) {
        toast.error(`Failed to create server: ${error.message}`);
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  };

  return {
    createServerMultiStep,
    isPending: createMetadata.isPending || installExtensions.isPending || cloneWorkspace.isPending,
    error: createMetadata.error || installExtensions.error || cloneWorkspace.error,
  };
};
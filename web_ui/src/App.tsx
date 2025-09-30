import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { useQueryState } from 'nuqs';
import { Toaster } from '@/components/ui/sonner';
import { RefreshCw, Loader2, Terminal, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ServerTable from '@/components/ServerTable';
import CreateServerSplitButton from '@/components/CreateServerSplitButton';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import ErrorBoundary from '@/components/ErrorBoundary';
import LogViewer from '@/components/LogViewer';
import { useDeleteServer, useServers, useMultiStepServerCreation, useTemplates } from '@/hooks/useServers';
import { useExtensionGroups } from '@/hooks/useConfig';
import { useStatusRefresh } from '@/hooks/useStatusRefresh';
import type { ServerResponse, TemplateItem } from '@/types/api';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ServerManagementApp() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<ServerResponse | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Track installation progress by server ID
  const [installationProgress, setInstallationProgress] = useState<Map<string, {
    step: string;
    current: number;
    total: number;
  }>>(new Map());


  // URL state for the main tab
  const [activeTab, setActiveTab] = useQueryState('tab', {
    defaultValue: 'servers',
    clearOnDefault: true
  });

  const { data: servers = [], refetch: refetchServers } = useServers();
  const deleteServerMutation = useDeleteServer();
  const { refreshAllServersStatus, onServerAction } = useStatusRefresh();

  // Server creation hooks - moved from child components
  const multiStepCreation = useMultiStepServerCreation();
  const { data: templates, isLoading: isTemplatesLoading } = useTemplates();
  const { extensionGroups } = useExtensionGroups();

  const handleDeleteConfirm = (serverId: string) => {
    const server = servers.find(s => s.id === serverId);
    if (server) {
      setServerToDelete(server);
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteServer = async () => {
    if (serverToDelete) {
      deleteServerMutation.mutate(serverToDelete.id, {
        onSuccess: async () => {
          // Wait for servers to be refetched and UI to update before closing dialog
          await refetchServers();
          // Add a small delay to ensure UI has updated
          await new Promise(resolve => setTimeout(resolve, 300));
          setDeleteDialogOpen(false);
          setServerToDelete(null);
        },
      });
    }
  };

  const handleRefresh = async () => {
    setIsManualRefreshing(true);

    try {
      // Use the new refresh API endpoint instead of just refetching
      await refreshAllServersStatus();
      // Also refetch to get the updated data
      await refetchServers();
    } catch (error) {
      console.error('Failed to refresh servers:', error);
    } finally {
      setIsManualRefreshing(false);
    }
  };

  // Server creation handlers - moved from child components
  const handleCreateServerFromForm = async (
    name: string,
    extensions: string[],
    groupsWithUserSettings: string[],
    zipFile?: File,
    githubUrl?: string
  ): Promise<boolean> => {
    let serverId: string | undefined;
    try {
      await multiStepCreation.createServerMultiStep(
        name,
        extensions,
        groupsWithUserSettings,
        zipFile,
        githubUrl,
        (step: string, current: number, total: number, serverIdParam?: string) => {
          if (serverIdParam) {
            serverId = serverIdParam;
            setInstallationProgress(prev => new Map(prev.set(serverIdParam, { step, current, total })));
          }
        }
      );
      // Clean up progress tracking on success
      if (serverId) {
        setInstallationProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(serverId!);
          return newMap;
        });
      }
      return true; // Success
    } catch (error) {
      console.error('Server creation failed:', error);
      // Clean up progress tracking on error
      if (serverId) {
        setInstallationProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(serverId!);
          return newMap;
        });
      }
      return false; // Failure
    }
  };

  const handleCreateServerFromTemplate = async (
    name: string,
    template: TemplateItem,
    _tabName: string
  ): Promise<boolean> => {
    // Build extensions list and count groups with user settings
    const allExtensions: string[] = [];
    const groupsWithUserSettings: string[] = [];

    for (const groupKey of template.extensions_groups) {
      if (extensionGroups && extensionGroups[groupKey]) {
        allExtensions.push(...extensionGroups[groupKey].extensions);
        // Check if this group has user settings
        if (extensionGroups[groupKey].user_settings && Object.keys(extensionGroups[groupKey].user_settings).length > 0) {
          groupsWithUserSettings.push(groupKey);
        }
      }
    }

    let serverId: string | undefined;
    try {
      await multiStepCreation.createServerMultiStep(
        name,
        allExtensions,
        groupsWithUserSettings,
        undefined, // no zip file
        template.github_url, // github URL from template
        (step: string, current: number, total: number, serverIdParam?: string) => {
          if (serverIdParam) {
            serverId = serverIdParam;
            setInstallationProgress(prev => new Map(prev.set(serverIdParam, { step, current, total })));
          }
        }
      );
      // Clean up progress tracking on success
      if (serverId) {
        setInstallationProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(serverId!);
          return newMap;
        });
      }
      return true; // Success
    } catch (error) {
      console.error('Template server creation failed:', error);
      // Clean up progress tracking on error
      if (serverId) {
        setInstallationProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(serverId!);
          return newMap;
        });
      }
      return false; // Failure
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg p-1.5 border border-border">
              <img src="/logo.png" alt="Databricks Devbox Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Databricks Devbox</h1>
              <p className="text-muted-foreground">
                Manage your Devbox instances
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isManualRefreshing}
            >
              {isManualRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isManualRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <CreateServerSplitButton
              onCreateFromForm={handleCreateServerFromForm}
              onCreateFromTemplate={handleCreateServerFromTemplate}
              templates={templates?.data || null}
              isTemplatesLoading={isTemplatesLoading}
              isCreating={multiStepCreation.isPending}
              extensionGroups={extensionGroups}
            />
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="servers" className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <span>Servers</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center space-x-2">
              <Terminal className="h-4 w-4" />
              <span>Logs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="servers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Server Instances</CardTitle>
                <CardDescription>
                  View and manage all your Devbox instances. Start, stop, restart, or delete servers as needed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ServerTable
                  onDeleteConfirm={handleDeleteConfirm}
                  onServerAction={onServerAction}
                  installationProgress={installationProgress}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <div className="h-[600px]">
              <LogViewer />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteServer}
        server={serverToDelete || undefined}
        variant="delete"
        confirmText="Delete Server"
        loading={deleteServerMutation.isPending}
      />

      <Toaster />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <ServerManagementApp />
        </NuqsAdapter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App

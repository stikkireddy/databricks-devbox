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
import CreateServerDialog from '@/components/CreateServerDialog';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import ErrorBoundary from '@/components/ErrorBoundary';
import LogViewer from '@/components/LogViewer';
import { useDeleteServer, useServers } from '@/hooks/useServers';
import { useStatusRefresh } from '@/hooks/useStatusRefresh';
import type { ServerResponse } from '@/types/api';

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

  // URL state for the main tab
  const [activeTab, setActiveTab] = useQueryState('tab', {
    defaultValue: 'servers',
    clearOnDefault: true
  });

  const { data: servers = [], refetch: refetchServers } = useServers();
  const deleteServerMutation = useDeleteServer();
  const { refreshAllServersStatus, onServerAction } = useStatusRefresh();

  const handleDeleteConfirm = (serverId: string) => {
    const server = servers.find(s => s.id === serverId);
    if (server) {
      setServerToDelete(server);
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteServer = () => {
    if (serverToDelete) {
      deleteServerMutation.mutate(serverToDelete.id, {
        onSuccess: () => {
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
              size="sm"
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
            <CreateServerDialog />
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
                <ServerTable onDeleteConfirm={handleDeleteConfirm} onServerAction={onServerAction} />
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

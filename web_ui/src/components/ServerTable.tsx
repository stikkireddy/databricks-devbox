import React from 'react';
import { Play, Square, RotateCcw, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ServerResponse } from '@/types/api';
import {
  useServers,
  useStartServer,
  useStopServer,
  useRestartServer,
} from '@/hooks/useServers';

const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status.toLowerCase()) {
    case 'running':
      return 'default';
    case 'starting':
      return 'secondary';
    case 'stopped':
      return 'outline';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
};

const formatUptime = (seconds?: number): string => {
  if (!seconds) return 'N/A';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatMemory = (mb?: number): string => {
  if (!mb) return 'N/A';

  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)}GB`;
  }
  return `${Math.round(mb)}MB`;
};

const formatCpuPercent = (percent?: number): string => {
  if (percent === undefined || percent === null) return 'N/A';
  return `${percent.toFixed(1)}%`;
};

const ServerActionButtons: React.FC<{
  server: ServerResponse;
  onDeleteConfirm: (id: string) => void;
  onServerAction?: () => void;
}> = ({ server, onDeleteConfirm, onServerAction }) => {
  const startServerMutation = useStartServer();
  const stopServerMutation = useStopServer();
  const restartServerMutation = useRestartServer();
  const isRunning = server.status === 'running';
  const isStopped = server.status === 'stopped';
  const isFailed = server.status === 'failed';

  // Check if any operation is pending for this specific server
  const isServerOperationPending =
    startServerMutation.isPending ||
    stopServerMutation.isPending ||
    restartServerMutation.isPending;

  return (
    <div className="flex items-center space-x-1">
      {/* Start Button - shown when stopped or failed */}
      {(isStopped || isFailed) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={isServerOperationPending}
          onClick={() => {
            startServerMutation.mutate(server.id);
            onServerAction?.();
          }}
          title="Start server"
        >
          {startServerMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* Stop Button - shown when running */}
      {isRunning && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={isServerOperationPending}
          onClick={() => {
            stopServerMutation.mutate(server.id);
            onServerAction?.();
          }}
          title="Stop server"
        >
          {stopServerMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* Restart Button - shown when running or failed */}
      {(isRunning || isFailed) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={isServerOperationPending}
          onClick={() => {
            restartServerMutation.mutate(server.id);
            onServerAction?.();
          }}
          title="Restart server"
        >
          {restartServerMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* Open VS Code Button - shown when running */}
      {isRunning && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          asChild
          title="Open VS Code"
        >
          <a
            href={`/vscode/${server.port}/`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      )}

      {/* Delete Button - always shown */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
        disabled={isServerOperationPending}
        onClick={() => onDeleteConfirm(server.id)}
        title="Delete server"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

const ServerTable: React.FC<{
  onDeleteConfirm: (id: string) => void;
  onServerAction?: () => void;
}> = ({
  onDeleteConfirm,
  onServerAction,
}) => {
  const { data: servers = [], isLoading, error } = useServers();

  // Get mutation hooks to check loading states
  const startServerMutation = useStartServer();
  const stopServerMutation = useStopServer();
  const restartServerMutation = useRestartServer();
  if (error) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm text-destructive">
          Failed to load servers: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <div className="text-sm text-muted-foreground">Loading servers...</div>
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center">
        <div className="text-sm text-muted-foreground mb-2">No servers found</div>
        <div className="text-xs text-muted-foreground">
          Create your first Devbox instance to get started
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Port</TableHead>
            <TableHead>Workspace</TableHead>
            <TableHead>Uptime</TableHead>
            <TableHead>CPU</TableHead>
            <TableHead>Memory</TableHead>
            <TableHead>PID</TableHead>
            <TableHead className="w-[180px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {servers.map((server) => {
            // Check if this specific server has pending operations
            const isServerStarting = startServerMutation.isPending;
            const isServerStopping = stopServerMutation.isPending;
            const isServerRestarting = restartServerMutation.isPending;
            const hasAnyOperation = isServerStarting || isServerStopping || isServerRestarting;

            return (
              <TableRow key={server.id}>
                <TableCell className="font-medium">{server.name}</TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getStatusVariant(server.status)}>
                      {hasAnyOperation && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      {isServerStarting ? 'Starting...' :
                       isServerStopping ? 'Stopping...' :
                       isServerRestarting ? 'Restarting...' :
                       server.status}
                    </Badge>
                  </div>
                </TableCell>
              <TableCell>{server.port}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={server.workspace_path}>
                {server.workspace_path}
              </TableCell>
              <TableCell>{formatUptime(server.uptime)}</TableCell>
              <TableCell>{formatCpuPercent(server.cpu_percent)}</TableCell>
              <TableCell>{formatMemory(server.memory_mb)}</TableCell>
              <TableCell>{server.pid || 'N/A'}</TableCell>
              <TableCell>
                <ServerActionButtons
                  server={server}
                  onDeleteConfirm={onDeleteConfirm}
                  onServerAction={onServerAction}
                />
              </TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
    </div>
  );
};

export default ServerTable;
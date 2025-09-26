import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { serverKeys } from './useServers';

export const useStatusRefresh = () => {
  const queryClient = useQueryClient();
  const intervalRef = useRef<number | null>(null);
  const fastIntervalRef = useRef<number | null>(null);
  const recentActionRef = useRef<boolean>(false);

  // Clear all intervals
  const clearIntervals = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (fastIntervalRef.current) {
      clearInterval(fastIntervalRef.current);
      fastIntervalRef.current = null;
    }
  }, []);

  // Refresh all servers status and invalidate cache
  const refreshAllServersStatus = useCallback(async () => {
    try {
      const result = await apiService.refreshAllServersStatus();
      // Invalidate and refetch the servers list to get updated data
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
      return result;
    } catch (error) {
      console.error('Failed to refresh server statuses:', error);
      throw error;
    }
  }, [queryClient]);

  // Refresh single server status
  const refreshServerStatus = useCallback(async (serverId: string) => {
    try {
      const result = await apiService.refreshServerStatus(serverId);
      // Invalidate queries for this specific server
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serverKeys.health(serverId) });
      return result;
    } catch (error) {
      console.error(`Failed to refresh server ${serverId} status:`, error);
      throw error;
    }
  }, [queryClient]);

  // Start normal polling (every 5 seconds, refresh all every 15 seconds)
  const startNormalPolling = useCallback(() => {
    clearIntervals();

    // Refresh all servers every 15 seconds
    intervalRef.current = setInterval(() => {
      refreshAllServersStatus();
    }, 15000);
  }, [clearIntervals, refreshAllServersStatus]);

  // Start fast polling after an action (every 1 second for 5 seconds)
  const startFastPolling = useCallback(() => {
    clearIntervals();
    recentActionRef.current = true;

    let fastPollCount = 0;
    const maxFastPolls = 5; // 5 seconds of fast polling

    // Fast refresh every 1 second
    fastIntervalRef.current = setInterval(() => {
      refreshAllServersStatus();
      fastPollCount++;

      // After 5 seconds, switch back to normal polling
      if (fastPollCount >= maxFastPolls) {
        recentActionRef.current = false;
        startNormalPolling();
      }
    }, 1000);
  }, [clearIntervals, refreshAllServersStatus, startNormalPolling]);

  // Trigger fast polling after an action (start/stop/restart)
  const onServerAction = useCallback(() => {
    startFastPolling();
  }, [startFastPolling]);

  // Initialize polling when hook mounts
  useEffect(() => {
    startNormalPolling();

    // Cleanup on unmount
    return () => {
      clearIntervals();
    };
  }, [startNormalPolling, clearIntervals]);

  return {
    refreshAllServersStatus,
    refreshServerStatus,
    onServerAction,
    isInFastPollMode: recentActionRef.current,
  };
};
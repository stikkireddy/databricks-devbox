import { useState, useEffect, useRef } from 'react';
import { useQueryState } from 'nuqs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Terminal, Trash2, Download, Search, Filter } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: string;
  serverId?: string;
  serverName?: string;
  source: string; // 'system' | 'server' | 'stdout' | 'stderr'
  message: string;
}

interface LogViewerProps {
  serverId?: string; // If provided, show logs for specific server
}

export default function LogViewer({ serverId }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // URL state for logs filtering
  const [selectedTab, setSelectedTab] = useQueryState('logTab', {
    defaultValue: 'all',
    clearOnDefault: true
  });
  const [searchQuery, setSearchQuery] = useQueryState('search', {
    defaultValue: '',
    clearOnDefault: true
  });
  const [selectedServer, setSelectedServer] = useQueryState('server', {
    defaultValue: 'all',
    clearOnDefault: true
  });

  useEffect(() => {
    // Connect to WebSocket for real-time logs
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/logs${serverId ? `/${serverId}` : ''}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log('Log WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'initial_logs') {
          // Initial 1000 lines of logs
          setLogs(data.logs || []);
        } else if (data.type === 'new_log') {
          // New log entry
          setLogs(prev => {
            const newLogs = [...prev, data.log];
            // Keep only last 10000 logs
            return newLogs.slice(-10000);
          });
        }
      } catch (error) {
        console.error('Error parsing log message:', error);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('Log WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('Log WebSocket error:', error);
      setConnected(false);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [serverId]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    setAutoScroll(isAtBottom);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  // Get unique servers from logs
  const uniqueServers = Array.from(new Set(
    logs
      .filter(log => log.serverName)
      .map(log => log.serverName!)
  )).sort();

  const downloadLogs = () => {
    const logText = filteredLogs.map(log =>
      `[${log.timestamp}] [${log.level}] [${log.source}] ${log.serverName ? `[${log.serverName}] ` : ''}${log.message}`
    ).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lha-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(log => {
    // Tab filtering
    let tabMatch = true;
    if (selectedTab === 'system') tabMatch = log.source === 'system';
    else if (selectedTab === 'servers') tabMatch = log.source === 'server' || log.source === 'stdout' || log.source === 'stderr';
    else if (selectedTab === 'errors') tabMatch = log.level === 'ERROR' || log.level === 'WARN';

    // Search filtering
    const searchMatch = !searchQuery ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.serverName && log.serverName.toLowerCase().includes(searchQuery.toLowerCase()));

    // Server filtering
    const serverMatch = selectedServer === 'all' ||
      (selectedServer === 'system' && log.source === 'system') ||
      (selectedServer !== 'system' && log.serverName === selectedServer);

    return tabMatch && searchMatch && serverMatch;
  });

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'destructive';
      case 'WARN': return 'secondary';
      case 'INFO': return 'default';
      case 'DEBUG': return 'outline';
      default: return 'default';
    }
  };


  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="h-5 w-5" />
            <CardTitle>
              {serverId ? 'Server Logs' : 'System Logs'}
            </CardTitle>
            <Badge variant={connected ? 'default' : 'destructive'} className="ml-2">
              {connected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="outline" onClick={downloadLogs}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button size="sm" variant="outline" onClick={clearLogs}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search logs..."
              value={searchQuery ?? ''}
              onChange={(e) => setSearchQuery(e.target.value || null)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedServer ?? 'all'} onValueChange={setSelectedServer}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by server" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="system">System Only</SelectItem>
                {uniqueServers.map((serverName) => (
                  <SelectItem key={serverName} value={serverName}>
                    {serverName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <Tabs value={selectedTab ?? 'all'} onValueChange={setSelectedTab} className="flex-1 flex flex-col">
          <div className="px-6 pb-2 border-b">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({filteredLogs.length})</TabsTrigger>
              <TabsTrigger value="system">System</TabsTrigger>
              <TabsTrigger value="servers">Servers</TabsTrigger>
              <TabsTrigger value="errors">Errors</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={selectedTab ?? 'all'} className="flex-1 mt-0">
            <ScrollArea
              className="h-96 px-6 py-2"
              onScrollCapture={handleScroll}
              ref={scrollRef}
            >
              <div className="space-y-1 font-mono text-sm">
                {filteredLogs.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    No logs to display
                  </div>
                ) : (
                  filteredLogs.map((log, index) => (
                    <div
                      key={index}
                      className="flex items-start space-x-2 py-1 px-2 hover:bg-muted/50 rounded text-xs"
                    >
                      <span className="text-muted-foreground min-w-0 flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <Badge
                        variant={getLogLevelColor(log.level)}
                        className="min-w-0 flex-shrink-0 text-xs"
                      >
                        {log.level}
                      </Badge>
                      {log.serverName && (
                        <Badge variant="outline" className="min-w-0 flex-shrink-0 text-xs">
                          {log.serverName}
                        </Badge>
                      )}
                      <span className="flex-1 min-w-0 break-words">
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {!autoScroll && (
                <div className="sticky bottom-0 left-0 right-0 flex justify-center py-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAutoScroll(true);
                      if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                      }
                    }}
                  >
                    Scroll to Bottom
                  </Button>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
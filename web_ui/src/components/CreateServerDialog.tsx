import React, { useState, useRef } from 'react';
import { Plus, X, Loader2, ChevronDown, Upload, Github, FolderOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useCreateServer, useCreateServerWithWorkspace, useMultiStepServerCreation } from '@/hooks/useServers';
import type { ServerConfig } from '@/types/api';

interface CreateServerDialogProps {
  trigger?: React.ReactNode;
}

// Predefined extension groups
const EXTENSION_GROUPS = {
  python: {
    name: 'Python',
    extensions: ['ms-python.python', 'ms-pyright.pyright']
  },
  jupyter: {
    name: 'Jupyter',
    extensions: [
      'ms-toolsai.jupyter',
      'ms-toolsai.jupyter-renderers',
      'ms-toolsai.jupyter-keymap',
      'ms-toolsai.vscode-jupyter-cell-tags'
    ]
  },
  databricks: {
    name: 'Databricks',
    extensions: [
      'databricks.databricks',
      'databricks.sqltools-databricks-driver'
    ]
  },
  'api-explorer': {
    name: 'API Explorer',
    extensions: ['rangav.vscode-thunder-client']
  }
};

const CreateServerDialog: React.FC<CreateServerDialogProps> = ({ trigger }) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<ServerConfig>({
    name: '',
    workspace_path: '', // This will be set by the backend
    extensions: [],
  });
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [workspaceType, setWorkspaceType] = useState<'empty' | 'upload' | 'github'>('empty');
  const [githubUrl, setGithubUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progress tracking state
  const [progressStep, setProgressStep] = useState('');
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  const createServerMutation = useCreateServer();
  const createServerWithWorkspaceMutation = useCreateServerWithWorkspace();
  const multiStepCreation = useMultiStepServerCreation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return;
    }

    // Validate based on workspace type
    if (workspaceType === 'github' && !githubUrl.trim()) {
      return;
    }
    if (workspaceType === 'upload' && !selectedFile) {
      return;
    }

    // Collect all extensions from selected groups
    const allExtensions: string[] = [];
    selectedGroups.forEach(groupKey => {
      const group = EXTENSION_GROUPS[groupKey as keyof typeof EXTENSION_GROUPS];
      if (group) {
        allExtensions.push(...group.extensions);
      }
    });

    try {
      // Use the appropriate API method based on workspace type
      if (workspaceType === 'empty') {
        // Use the original API for empty workspaces
        const submitData: ServerConfig = {
          ...formData,
          extensions: allExtensions
        };

        await createServerMutation.mutateAsync(submitData);
      } else {
        // Use multi-step approach with progress tracking for workspace initialization
        await multiStepCreation.createServerMultiStep(
          formData.name,
          allExtensions,
          workspaceType === 'upload' ? selectedFile || undefined : undefined,
          workspaceType === 'github' ? githubUrl : undefined,
          (step: string, current: number, total: number) => {
            setProgressStep(step);
            setProgressCurrent(current);
            setProgressTotal(total);
          }
        );
      }

      setOpen(false);
      resetForm();
    } catch (error) {
      // Error handling is done in the hooks
      console.error('Server creation failed:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      workspace_path: '', // This will be set by the backend
      extensions: [],
    });
    setSelectedGroups(new Set());
    setDropdownOpen(false);
    setWorkspaceType('empty');
    setGithubUrl('');
    setSelectedFile(null);
    setProgressStep('');
    setProgressCurrent(0);
    setProgressTotal(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGroupToggle = (groupKey: string) => {
    const newSelectedGroups = new Set(selectedGroups);
    if (newSelectedGroups.has(groupKey)) {
      newSelectedGroups.delete(groupKey);
    } else {
      newSelectedGroups.add(groupKey);
    }
    setSelectedGroups(newSelectedGroups);
  };

  const handleRemoveGroup = (groupKey: string) => {
    const newSelectedGroups = new Set(selectedGroups);
    newSelectedGroups.delete(groupKey);
    setSelectedGroups(newSelectedGroups);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/zip') {
      setSelectedFile(file);
    } else {
      alert('Please select a valid ZIP file');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/zip') {
      setSelectedFile(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = e.dataTransfer.files;
      }
    } else {
      alert('Please drop a valid ZIP file');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getLoadingMessage = () => {
    // For multi-step creation, show current progress step
    if (multiStepCreation.isPending && progressStep) {
      return progressStep;
    }

    if (createServerMutation.isPending && workspaceType === 'empty') {
      return 'Creating...';
    }
    if (createServerWithWorkspaceMutation.isPending) {
      switch (workspaceType) {
        case 'upload':
          return 'Extracting & Creating...';
        case 'github':
          return 'Cloning & Creating...';
        default:
          return 'Creating...';
      }
    }
    return 'Creating...';
  };

  const isAnyMutationPending = () => {
    return createServerMutation.isPending || createServerWithWorkspaceMutation.isPending || multiStepCreation.isPending;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button disabled={isAnyMutationPending()}>
            {isAnyMutationPending() ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {isAnyMutationPending() ? getLoadingMessage() : 'Create Server'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Create Code Server</DialogTitle>
          <DialogDescription>
            Create a new Code server instance. Enter a name, choose how to initialize the workspace, and select extensions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Server Name *</Label>
              <Input
                id="name"
                placeholder="My Code Server"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Workspace Initialization</Label>
              <Tabs value={workspaceType} onValueChange={(value) => setWorkspaceType(value as 'empty' | 'upload' | 'github')}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="empty" className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Empty
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Zip
                  </TabsTrigger>
                  <TabsTrigger value="github" className="flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    GitHub
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="empty" className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Start with an empty workspace
                  </p>
                </TabsContent>

                <TabsContent value="upload" className="space-y-2">
                  <div
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                    onDrop={handleFileDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    {selectedFile ? (
                      <div>
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">Drag & drop a ZIP file here</p>
                        <p className="text-sm text-muted-foreground">or click to browse</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="github" className="space-y-2">
                  <div className="space-y-2">
                    <Label htmlFor="github-url">GitHub Repository URL</Label>
                    <Input
                      id="github-url"
                      placeholder="https://github.com/user/repo.git"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Enter a public GitHub repository URL (HTTPS or SSH)
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>


            <div className="space-y-2">
              <Label>Extension Groups</Label>
              <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full justify-between"
                  >
                    <span>
                      {selectedGroups.size === 0
                        ? 'Select extension groups'
                        : `${selectedGroups.size} group${selectedGroups.size === 1 ? '' : 's'} selected`
                      }
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-56"
                  align="start"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {Object.entries(EXTENSION_GROUPS).map(([key, group]) => (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={selectedGroups.has(key)}
                      onCheckedChange={() => handleGroupToggle(key)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {group.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {selectedGroups.size > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Selected groups:</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(selectedGroups).map((groupKey) => {
                      const group = EXTENSION_GROUPS[groupKey as keyof typeof EXTENSION_GROUPS];
                      return (
                        <Badge
                          key={groupKey}
                          variant="secondary"
                          className="flex items-center space-x-1"
                        >
                          <span>{group.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground ml-1"
                            onClick={() => handleRemoveGroup(groupKey)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Progress indicator for multi-step creation */}
            {multiStepCreation.isPending && progressTotal > 0 && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Progress</span>
                  <span className="text-muted-foreground">
                    Step {progressCurrent} of {progressTotal}
                  </span>
                </div>
                <Progress value={(progressCurrent / progressTotal) * 100} className="h-2" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progressStep}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              disabled={isAnyMutationPending()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !formData.name.trim() ||
                isAnyMutationPending() ||
                (workspaceType === 'github' && !githubUrl.trim()) ||
                (workspaceType === 'upload' && !selectedFile)
              }
            >
              {isAnyMutationPending() && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isAnyMutationPending() ? getLoadingMessage() : 'Create Server'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateServerDialog;
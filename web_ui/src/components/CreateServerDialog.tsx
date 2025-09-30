import React, { useState, useRef } from 'react';
import { Plus, Loader2 } from 'lucide-react';
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
import { useCreateServer, useCreateServerWithWorkspace } from '@/hooks/useServers';
import { useExtensionGroups } from '@/hooks/useConfig';

interface CreateServerRequest {
  name: string;
  workspace_path: string;
  extensions: string[];
}
import { WorkspaceTabs } from './WorkspaceTabs';
import { ExtensionGroups } from './ExtensionGroups';

interface CreateServerDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreateServer?: (
    name: string,
    extensions: string[],
    groupsWithUserSettings: string[],
    zipFile?: File,
    githubUrl?: string
  ) => Promise<boolean> | void;
  extensionGroups?: Record<string, any>;
}

const CreateServerDialog: React.FC<CreateServerDialogProps> = ({
  trigger,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  onCreateServer,
  extensionGroups
}) => {
  const [internalOpen, setInternalOpen] = useState(false);

  // Use external open state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;
  const [formData, setFormData] = useState<CreateServerRequest>({
    name: '',
    workspace_path: '',
    extensions: [],
  });
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [workspaceType, setWorkspaceType] = useState<'empty' | 'upload' | 'github'>('empty');
  const [githubUrl, setGithubUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fallback for legacy usage when no parent props are provided
  const createServerMutation = useCreateServer();
  const createServerWithWorkspaceMutation = useCreateServerWithWorkspace();
  const { extensionGroups: fallbackExtensionGroups, isLoading: configLoading } = useExtensionGroups();

  // Use prop extensionGroups if provided, otherwise use hook result
  const effectiveExtensionGroups = extensionGroups || fallbackExtensionGroups;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return;
    }

    if (workspaceType === 'github' && !githubUrl.trim()) {
      return;
    }
    if (workspaceType === 'upload' && !selectedFile) {
      return;
    }

    const allExtensions: string[] = [];
    selectedGroups.forEach(groupKey => {
      const group = effectiveExtensionGroups && effectiveExtensionGroups[groupKey];
      if (group) {
        allExtensions.push(...group.extensions);
      }
    });

    try {
      // Calculate groups with user settings
      const groupsWithUserSettings: string[] = [];
      for (const groupKey of selectedGroups) {
        if (effectiveExtensionGroups && effectiveExtensionGroups[groupKey]) {
          if (effectiveExtensionGroups[groupKey].user_settings && Object.keys(effectiveExtensionGroups[groupKey].user_settings).length > 0) {
            groupsWithUserSettings.push(groupKey);
          }
        }
      }

      // Use parent creation function if available
      if (onCreateServer) {
        // Start the creation process but don't wait for it to complete
        onCreateServer(
          formData.name,
          allExtensions,
          groupsWithUserSettings,
          workspaceType === 'upload' ? selectedFile || undefined : undefined,
          workspaceType === 'github' ? githubUrl : undefined
        );
      } else {
        // Fallback to legacy creation for backwards compatibility
        if (selectedGroups.size > 0) {
          // This should not happen in the new architecture, but kept for safety
          console.warn('Using legacy creation - this should not happen in the new architecture');
        }
        const submitData: CreateServerRequest = {
          ...formData,
          extensions: allExtensions
        };
        await createServerMutation.mutateAsync(submitData as any);
      }

      // Close dialog immediately so user can see progress in table
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error('Server creation failed:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      workspace_path: '',
      extensions: [],
    });
    setSelectedGroups(new Set());
    setDropdownOpen(false);
    setWorkspaceType('empty');
    setGithubUrl('');
    setSelectedFile(null);
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
    return createServerMutation.isPending || createServerWithWorkspaceMutation.isPending;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {(trigger || externalOpen === undefined) && (
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
      )}
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Create Devbox Instance</DialogTitle>
          <DialogDescription>
            Create a new Devbox instance. Enter a name, choose how to initialize the workspace, and select extensions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Server Name *</Label>
              <Input
                id="name"
                placeholder="My Devbox Instance"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <WorkspaceTabs
              workspaceType={workspaceType}
              setWorkspaceType={setWorkspaceType}
              githubUrl={githubUrl}
              setGithubUrl={setGithubUrl}
              selectedFile={selectedFile}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
              onFileDrop={handleFileDrop}
              onDragOver={handleDragOver}
            />

            <ExtensionGroups
              configLoading={configLoading}
              extensionGroups={effectiveExtensionGroups}
              selectedGroups={selectedGroups}
              dropdownOpen={dropdownOpen}
              setDropdownOpen={setDropdownOpen}
              onGroupToggle={handleGroupToggle}
              onRemoveGroup={handleRemoveGroup}
            />
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
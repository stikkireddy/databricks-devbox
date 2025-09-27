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
import { useCreateServer, useCreateServerWithWorkspace, useMultiStepServerCreation } from '@/hooks/useServers';
import { useExtensionGroups } from '@/hooks/useConfig';

interface CreateServerRequest {
  name: string;
  workspace_path: string;
  extensions: string[];
}
import { WorkspaceTabs } from './WorkspaceTabs';
import { ExtensionGroups } from './ExtensionGroups';
import { ProgressIndicator } from './ProgressIndicator';

interface CreateServerDialogProps {
  trigger?: React.ReactNode;
}

const CreateServerDialog: React.FC<CreateServerDialogProps> = ({ trigger }) => {
  const [open, setOpen] = useState(false);
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

  // Progress tracking state
  const [progressStep, setProgressStep] = useState('');
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  // Get extension groups from config
  const { extensionGroups, isLoading: configLoading } = useExtensionGroups();

  const createServerMutation = useCreateServer();
  const createServerWithWorkspaceMutation = useCreateServerWithWorkspace();
  const multiStepCreation = useMultiStepServerCreation();

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
      const group = extensionGroups[groupKey];
      if (group) {
        allExtensions.push(...group.extensions);
      }
    });

    try {
      if (workspaceType === 'empty') {
        const submitData: CreateServerRequest = {
          ...formData,
          extensions: allExtensions
        };
        await createServerMutation.mutateAsync(submitData as any);
      } else {
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
              extensionGroups={extensionGroups}
              selectedGroups={selectedGroups}
              dropdownOpen={dropdownOpen}
              setDropdownOpen={setDropdownOpen}
              onGroupToggle={handleGroupToggle}
              onRemoveGroup={handleRemoveGroup}
            />

            <ProgressIndicator
              isPending={multiStepCreation.isPending}
              progressStep={progressStep}
              progressCurrent={progressCurrent}
              progressTotal={progressTotal}
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
import React from 'react';
import { Upload, Github, FolderOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WorkspaceTabsProps {
  workspaceType: 'empty' | 'upload' | 'github';
  setWorkspaceType: (type: 'empty' | 'upload' | 'github') => void;
  githubUrl: string;
  setGithubUrl: (url: string) => void;
  selectedFile: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
}

export const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  workspaceType,
  setWorkspaceType,
  githubUrl,
  setGithubUrl,
  selectedFile,
  fileInputRef,
  onFileSelect,
  onFileDrop,
  onDragOver,
}) => (
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
          onDrop={onFileDrop}
          onDragOver={onDragOver}
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
            onChange={onFileSelect}
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
);
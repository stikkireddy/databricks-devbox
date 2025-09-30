import React, { useState } from 'react';
import { Plus, ChevronDown, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CreateServerDialog from './CreateServerDialog';
import TemplateWizard from './TemplateWizard';
import type { TemplateItem, PackagedAssets } from '@/types/api';

interface CreateServerSplitButtonProps {
  disabled?: boolean;
  onCreateFromForm: (
    name: string,
    extensions: string[],
    groupsWithUserSettings: string[],
    zipFile?: File,
    githubUrl?: string
  ) => Promise<boolean>;
  onCreateFromTemplate: (
    name: string,
    template: TemplateItem,
    tabName: string
  ) => Promise<boolean>;
  templates: PackagedAssets | null;
  isTemplatesLoading: boolean;
  isCreating: boolean;
  extensionGroups: Record<string, any>;
}

const CreateServerSplitButton: React.FC<CreateServerSplitButtonProps> = ({
  disabled = false,
  onCreateFromForm,
  onCreateFromTemplate,
  templates,
  isTemplatesLoading,
  isCreating,
  extensionGroups
}) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [templateWizardOpen, setTemplateWizardOpen] = useState(false);

  const handleCreateFromTemplate = async (name: string, template: TemplateItem, tabName: string) => {
    return await onCreateFromTemplate(name, template, tabName);
  };

  return (
    <div className="flex">
      {/* Main Create Server Button */}
      <Button
        onClick={() => setCreateDialogOpen(true)}
        disabled={disabled || isCreating}
        className="rounded-r-none border-r-0"
      >
        {isCreating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-2 h-4 w-4" />
        )}
        Create Server
      </Button>

      {/* Dropdown Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            size="icon"
            disabled={disabled || isCreating}
            className="rounded-l-none border-l border-primary-foreground/20 w-8 px-0"
          >
            <ChevronDown className="h-4 w-4" />
            <span className="sr-only">More creation options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => setTemplateWizardOpen(true)}
            disabled={isTemplatesLoading}
          >
            <FileText className="mr-2 h-4 w-4" />
            Create from template
            {isTemplatesLoading && (
              <Loader2 className="ml-auto h-4 w-4 animate-spin" />
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Regular Create Server Dialog */}
      <CreateServerDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreateServer={onCreateFromForm}
        extensionGroups={extensionGroups}
      />

      {/* Template Wizard */}
      <TemplateWizard
        open={templateWizardOpen}
        onOpenChange={setTemplateWizardOpen}
        templates={templates}
        isTemplatesLoading={isTemplatesLoading}
        onCreateServer={handleCreateFromTemplate}
        isCreating={isCreating}
      />
    </div>
  );
};

export default CreateServerSplitButton;
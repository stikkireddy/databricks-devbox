import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TemplateGrid from './TemplateGrid';
import type { TemplateItem, PackagedAssets } from '@/types/api';

interface TemplateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: PackagedAssets | null;
  isTemplatesLoading: boolean;
  onCreateServer: (name: string, template: TemplateItem, tabName: string) => Promise<boolean> | void;
  isCreating: boolean;
}

type WizardStep = 'template-selection' | 'server-config';

const TemplateWizard: React.FC<TemplateWizardProps> = ({
  open,
  onOpenChange,
  templates,
  isTemplatesLoading,
  onCreateServer,
  isCreating,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('template-selection');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [serverName, setServerName] = useState('');


  const handleClose = () => {
    onOpenChange(false);
    // Reset state when closing
    setTimeout(() => {
      setCurrentStep('template-selection');
      setSelectedTemplate(null);
      setSelectedTab(null);
      setServerName('');
    }, 200);
  };

  const handleTemplateSelect = (template: TemplateItem, tabName: string) => {
    setSelectedTemplate(template);
    setSelectedTab(tabName);
  };

  const handleNextStep = () => {
    if (currentStep === 'template-selection' && selectedTemplate) {
      setCurrentStep('server-config');
      // Auto-populate server name based on template
      if (!serverName) {
        const baseName = selectedTemplate.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        setServerName(`${baseName}-server`);
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === 'server-config') {
      setCurrentStep('template-selection');
    }
  };

  const handleCreateServer = async () => {
    if (selectedTemplate && selectedTab && serverName.trim()) {
      try {
        // Start the creation process but don't wait for it to complete
        onCreateServer(serverName.trim(), selectedTemplate, selectedTab);
        // Close immediately so user can see progress in table
        handleClose();
      } catch (error) {
        console.error('Failed to create server:', error);
      }
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'template-selection':
        return 'Choose a Template';
      case 'server-config':
        return 'Configure Server';
      default:
        return 'Create from Template';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 'template-selection':
        return 'Select a template to use as the starting point for your new server.';
      case 'server-config':
        return 'Give your server a name and review the configuration.';
      default:
        return '';
    }
  };

  const canProceedToNext = () => {
    return currentStep === 'template-selection' && selectedTemplate !== null;
  };

  const canCreateServer = () => {
    return (
      currentStep === 'server-config' &&
      selectedTemplate !== null &&
      serverName.trim().length > 0 &&
      !isCreating
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStepTitle()}
            <span className="text-sm text-muted-foreground font-normal">
              ({currentStep === 'template-selection' ? '1' : '2'} of 2)
            </span>
          </DialogTitle>
          <DialogDescription>
            {getStepDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 px-1">
          {currentStep === 'template-selection' && (
            <TemplateGrid
              templates={templates}
              isLoading={isTemplatesLoading}
              selectedTemplate={selectedTemplate}
              selectedTab={selectedTab}
              onTemplateSelect={handleTemplateSelect}
            />
          )}

          {currentStep === 'server-config' && selectedTemplate && (
            <div className="space-y-6">
              {/* Selected Template Summary */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <h3 className="font-medium mb-2">Selected Template</h3>
                <div className="flex items-start gap-4">
                  {selectedTemplate.thumbnail_url && (
                    <img
                      src={selectedTemplate.thumbnail_url}
                      alt={`${selectedTemplate.name} logo`}
                      className="w-12 h-12 object-contain rounded"
                    />
                  )}
                  <div>
                    <h4 className="font-medium">{selectedTemplate.name}</h4>
                    <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedTemplate.extensions_groups.map((group, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20"
                        >
                          {group}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Server Configuration */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="server-name">Server Name *</Label>
                  <Input
                    id="server-name"
                    placeholder="Enter server name"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    disabled={isCreating}
                  />
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>
                    The server will be configured with the selected template's extensions and
                    workspace will be initialized from the GitHub repository:
                  </p>
                  <code className="bg-muted px-2 py-1 rounded mt-1 inline-block">
                    {selectedTemplate.github_url}
                  </code>
                </div>
              </div>

            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex gap-2">
            {currentStep === 'server-config' && (
              <Button
                variant="outline"
                onClick={handlePreviousStep}
                disabled={isCreating}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>

            {currentStep === 'template-selection' && (
              <Button
                onClick={handleNextStep}
                disabled={!canProceedToNext()}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}

            {currentStep === 'server-config' && (
              <Button
                onClick={handleCreateServer}
                disabled={!canCreateServer()}
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isCreating ? 'Creating...' : 'Create Server'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateWizard;
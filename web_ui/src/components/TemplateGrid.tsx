import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import TemplateCard from './TemplateCard';
import type { PackagedAssets, TemplateItem } from '@/types/api';

interface TemplateGridProps {
  templates: PackagedAssets | null;
  isLoading: boolean;
  selectedTemplate: TemplateItem | null;
  selectedTab: string | null;
  onTemplateSelect: (template: TemplateItem, tabName: string) => void;
}

const TemplateGrid: React.FC<TemplateGridProps> = ({
  templates,
  isLoading,
  selectedTemplate,
  selectedTab,
  onTemplateSelect,
}) => {
  const [activeTab, setActiveTab] = useState<string>(
    templates?.tabs?.[0]?.name || ''
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading templates...</span>
      </div>
    );
  }

  if (!templates || templates.tabs.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No templates are available. Templates can be configured in the devbox.yaml file.
        </AlertDescription>
      </Alert>
    );
  }

  // Initialize activeTab if not set
  React.useEffect(() => {
    if (!activeTab && templates.tabs.length > 0) {
      setActiveTab(templates.tabs[0].name);
    }
  }, [templates.tabs, activeTab]);

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tab Navigation */}
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 h-auto p-1">
          {templates.tabs.map((tab) => (
            <TabsTrigger
              key={tab.name}
              value={tab.name}
              className="text-sm py-2 px-4"
            >
              {tab.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab Content */}
        {templates.tabs.map((tab) => (
          <TabsContent key={tab.name} value={tab.name} className="mt-6">
            {tab.items.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No templates found in the "{tab.name}" category.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                {tab.items.map((template) => (
                  <TemplateCard
                    key={template.name}
                    template={template}
                    isSelected={
                      selectedTemplate?.name === template.name &&
                      selectedTab === tab.name
                    }
                    onSelect={() => onTemplateSelect(template, tab.name)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default TemplateGrid;
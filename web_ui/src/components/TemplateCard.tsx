import React from 'react';
import { ExternalLink, Github } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { TemplateItem } from '@/types/api';

interface TemplateCardProps {
  template: TemplateItem;
  onSelect: () => void;
  isSelected?: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onSelect, isSelected = false }) => {
  // Get lucide icon component by name
  const getLucideIcon = (_iconName: string) => {
    // For now, we'll just show the external link icon for all custom icons
    // In a real implementation, you'd want to import and map lucide icons
    return <ExternalLink className="h-4 w-4" />;
  };

  const handleLinkClick = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary border-primary' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{template.name}</CardTitle>
            <CardDescription className="text-sm">{template.description}</CardDescription>
          </div>
          {template.thumbnail_url && (
            <div className="ml-4 flex-shrink-0">
              <img
                src={template.thumbnail_url}
                alt={`${template.name} logo`}
                className="w-12 h-12 object-contain rounded"
                onError={(e) => {
                  // Hide image on error
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Extension Groups */}
        {template.extensions_groups && template.extensions_groups.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {template.extensions_groups.map((group, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {group}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Links */}
        <div className="flex flex-wrap gap-2">
          {/* GitHub link */}
          {template.github_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => handleLinkClick(template.github_url, e)}
              className="flex items-center gap-1"
            >
              <Github className="h-3 w-3" />
              GitHub
            </Button>
          )}

          {/* Custom icon links */}
          {template.icon_links?.map((link, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={(e) => handleLinkClick(link.url, e)}
              className="flex items-center gap-1"
            >
              {getLucideIcon(link.lucide_icon)}
              {link.lucide_icon}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TemplateCard;
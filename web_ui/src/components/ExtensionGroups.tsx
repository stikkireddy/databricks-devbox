import React from 'react';
import { X, Loader2, ChevronDown, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ExtensionGroupsProps {
  configLoading: boolean;
  extensionGroups: Record<string, any>;
  selectedGroups: Set<string>;
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
  onGroupToggle: (groupKey: string) => void;
  onRemoveGroup: (groupKey: string) => void;
}

export const ExtensionGroups: React.FC<ExtensionGroupsProps> = ({
  configLoading,
  extensionGroups,
  selectedGroups,
  dropdownOpen,
  setDropdownOpen,
  onGroupToggle,
  onRemoveGroup,
}) => (
  <div className="space-y-2">
    <Label>Extension Groups</Label>
    {configLoading ? (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading extension groups...
      </div>
    ) : (
      <>
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
            {Object.entries(extensionGroups).map(([key, group]) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={selectedGroups.has(key)}
                onCheckedChange={() => onGroupToggle(key)}
                onSelect={(e) => e.preventDefault()}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <span>{group.name}</span>
                  {group.user_settings && Object.keys(group.user_settings).length > 0 && (
                    <Settings className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedGroups.size > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Selected groups:</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(selectedGroups).map((groupKey) => {
                const group = extensionGroups[groupKey];
                return (
                  <Badge
                    key={groupKey}
                    variant="secondary"
                    className="flex items-center space-x-1"
                  >
                    <span>{group?.name || groupKey}</span>
                    {group?.user_settings && Object.keys(group.user_settings).length > 0 && (
                      <Settings className="h-3 w-3 text-muted-foreground" />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground ml-1"
                      onClick={() => onRemoveGroup(groupKey)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </>
    )}
  </div>
);
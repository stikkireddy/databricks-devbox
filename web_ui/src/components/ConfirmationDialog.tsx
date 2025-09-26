import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ServerResponse } from '@/types/api';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  server?: ServerResponse;
  title?: string;
  description?: string;
  confirmText?: string;
  variant?: 'delete' | 'warning';
  loading?: boolean;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  server,
  title,
  description,
  confirmText = 'Confirm',
  variant = 'delete',
  loading = false,
}) => {
  const getTitle = () => {
    if (title) return title;
    if (variant === 'delete' && server) {
      return `Delete "${server.name}"?`;
    }
    return 'Confirm Action';
  };

  const getDescription = () => {
    if (description) return description;
    if (variant === 'delete' && server) {
      return (
        <div className="space-y-2">
          <p>
            This will permanently delete the Code server "{server.name}" and stop any running instances.
          </p>
          <div className="space-y-1 text-sm bg-muted p-3 rounded-md">
            <div><span className="font-medium">Port:</span> {server.port}</div>
            <div><span className="font-medium">Workspace:</span> {server.workspace_path}</div>
            <div><span className="font-medium">Status:</span> {server.status}</div>
          </div>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone.
          </p>
        </div>
      );
    }
    return 'Are you sure you want to continue?';
  };

  const getIcon = () => {
    if (variant === 'delete') {
      return <Trash2 className="h-6 w-6 text-destructive" />;
    }
    return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
  };

  const getConfirmButtonVariant = () => {
    return variant === 'delete' ? 'destructive' : 'default';
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center space-x-3">
            {getIcon()}
            <AlertDialogTitle>{getTitle()}</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            {getDescription()}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={getConfirmButtonVariant() === 'destructive' ?
              'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''
            }
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmationDialog;
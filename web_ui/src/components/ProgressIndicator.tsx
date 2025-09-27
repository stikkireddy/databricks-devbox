import React from 'react';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ProgressIndicatorProps {
  isPending: boolean;
  progressStep: string;
  progressCurrent: number;
  progressTotal: number;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  isPending,
  progressStep,
  progressCurrent,
  progressTotal,
}) => {
  if (!isPending || progressTotal === 0) {
    return null;
  }

  return (
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
  );
};
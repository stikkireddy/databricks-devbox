import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorInfo>;
}

interface State {
  hasError: boolean;
  error?: Error;
}

interface ErrorInfo {
  error?: Error;
  onRetry?: () => void;
}

const DefaultErrorFallback: React.FC<ErrorInfo> = ({ error, onRetry }) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="flex items-center justify-center w-12 h-12 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle className="h-6 w-6" />
          </div>
        </div>
        <CardTitle>Something went wrong</CardTitle>
        <CardDescription>
          The application encountered an unexpected error. Please try refreshing the page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground mb-2">
              Error details
            </summary>
            <div className="bg-muted p-3 rounded text-xs font-mono">
              {error.message}
            </div>
          </details>
        )}
        <div className="flex space-x-2">
          <Button
            onClick={onRetry}
            className="flex-1"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="flex-1"
          >
            Reload Page
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
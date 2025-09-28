import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class NotebookErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Notebook error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <h3 className="text-lg font-heading font-medium text-foreground mb-2">
              Something went wrong
            </h3>
            <p className="text-muted-foreground mb-4">
              The notebook encountered an unexpected error. Please try again.
            </p>
            {this.state.error && (
              <details className="text-left mb-4 bg-red-500/10 p-3 rounded border border-red-500/20">
                <summary className="text-sm text-red-400 cursor-pointer mb-2">
                  Error Details
                </summary>
                <pre className="text-xs text-red-300 whitespace-pre-wrap overflow-x-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <Button 
              onClick={this.handleRetry} 
              variant="primary"
              className="gap-2"
            >
              <RefreshCw size={16} />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default NotebookErrorBoundary;
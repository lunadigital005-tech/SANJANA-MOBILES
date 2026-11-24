import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SANJANA MOBILES Application Uncaught Error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full bg-white rounded-3xl border border-plum-100 p-8 shadow-card text-center space-y-5">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-coral-600 bg-coral-50 px-2.5 py-0.5 rounded-full">
                Application Exception
              </span>
              <h2 className="text-xl font-bold font-display text-plum-950 mt-2">
                An Unexpected Disruption Occurred
              </h2>
              <p className="text-xs text-plum-500 leading-relaxed">
                Our atelier interface experienced a temporary fault. Your session and bag data remain securely preserved.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-plum-50/60 rounded-xl text-[11px] font-mono text-plum-700 text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => (window.location.href = '/')}
                leftIcon={<Home className="w-3.5 h-3.5" />}
              >
                Return Home
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={this.handleReset}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Reload Atelier
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

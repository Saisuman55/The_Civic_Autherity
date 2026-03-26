import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let isQuotaExceeded = false;
      let errorMessage = this.state.error?.message || '';

      try {
        // Check if it's a JSON error from handleFirestoreError
        const parsedError = JSON.parse(errorMessage);
        if (parsedError.error && (parsedError.error.includes('quota') || parsedError.error.includes('Quota'))) {
          isQuotaExceeded = true;
        }
      } catch (e) {
        // Not a JSON error
        if (errorMessage.includes('quota') || errorMessage.includes('Quota')) {
          isQuotaExceeded = true;
        }
      }

      return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl text-center border border-neutral-200">
            <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 mb-4">
              {isQuotaExceeded ? 'Daily Limit Reached' : 'Something went wrong'}
            </h1>
            <p className="text-neutral-500 mb-8 leading-relaxed">
              {isQuotaExceeded 
                ? "The application has reached its daily database usage limit (free tier). The quota will reset tomorrow. Please check back then!"
                : "We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-3 bg-neutral-900 text-white py-4 px-6 rounded-2xl font-semibold hover:bg-neutral-800 transition-all shadow-lg"
            >
              <RefreshCcw className="w-5 h-5" />
              Refresh Application
            </button>
            {process.env.NODE_ENV !== 'production' && (
              <div className="mt-8 p-4 bg-neutral-900 text-left rounded-xl overflow-auto max-h-40">
                <pre className="text-[10px] text-red-400 font-mono">
                  {errorMessage}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

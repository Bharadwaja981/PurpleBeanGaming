import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackView?: () => void;
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
    console.error('Uncaught error caught by Purple Bean ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.fallbackView) {
      this.props.fallbackView();
    } else {
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-2xl mx-auto my-12 p-6 sm:p-8 bg-white border-[4px] border-black shadow-[8px_8px_0px_0px_#000] font-mono space-y-6">
          <div className="flex items-center gap-3 border-b-2 border-black pb-4">
            <div className="w-12 h-12 bg-[#FF5757] text-white border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
              <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-stone-500 block">
                PURPLE BEAN RECOVERY RADAR
              </span>
              <h2 className="font-sans font-black text-2xl uppercase text-black leading-none">
                SOMETHING UNEXPECTED OCCURRED
              </h2>
            </div>
          </div>

          <p className="text-xs text-stone-700 leading-relaxed">
            The page encountered an unexpected view state during navigation or authentication update. To protect your esports session integrity, the view has been paused safely.
          </p>

          {this.state.error?.message && (
            <div className="bg-stone-50 border-2 border-black p-3 text-[11px] text-stone-800 break-words">
              <strong>Diagnostics:</strong> {this.state.error.message}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2.5 bg-[#FFE600] hover:bg-[#FFDE59] text-black border-2 border-black font-mono text-xs font-black uppercase flex items-center gap-2 shadow-[3px_3px_0px_0px_#000] cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Return to Tournament Home</span>
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-black border-2 border-black font-mono text-xs font-black uppercase flex items-center gap-2 shadow-[3px_3px_0px_0px_#000] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry Current Screen</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

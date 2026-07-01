"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ClientErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Client render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 px-4 text-center">
            <p className="text-[var(--accent)] font-medium">
              Something went wrong loading the bracket.
            </p>
            <p className="text-sm text-[var(--muted)] max-w-md">
              {this.state.message || "Please refresh the page to try again."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded bg-[var(--hrr-blue)] text-white text-sm font-medium hover:bg-[var(--hrr-navy)] transition-colors"
            >
              Refresh
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

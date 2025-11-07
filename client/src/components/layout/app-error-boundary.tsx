"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("AppErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-secondary px-6 py-12 text-center">
          <div className="rounded-3xl border border-slate-100 bg-white px-8 py-10 shadow-soft">
            <div className="flex items-center justify-center gap-2 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
              <p className="font-semibold uppercase tracking-wide">
                Something went wrong
              </p>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              {this.state.error?.message ??
                "Unexpected error while rendering this view."}
            </p>
            <Button
              onClick={this.handleReset}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl"
            >
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

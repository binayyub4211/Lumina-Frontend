"use client";

import React from "react";
import {
  enqueueError,
  getQueuedErrorCount,
} from "@/src/lib/sentry/sentryClient";

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
  queuedErrors: number;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
    queuedErrors: 0,
  };

  static getDerivedStateFromError(
    error: Error,
  ): Pick<AppErrorBoundaryState, "error"> {
    return { error };
  }

  componentDidMount(): void {
    void this.refreshQueuedErrors();
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    void enqueueError(error, {
      component: "AppErrorBoundary",
      componentStack: errorInfo.componentStack ?? undefined,
    }).finally(() => this.refreshQueuedErrors());
  }

  refreshQueuedErrors = async (): Promise<void> => {
    const queuedErrors = await getQueuedErrorCount();
    this.setState({ queuedErrors });
  };

  retry = (): void => {
    this.setState({ error: null });
    void this.refreshQueuedErrors();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <section className="mx-auto max-w-xl rounded-3xl border border-rose-400/30 bg-slate-900/90 p-8 shadow-2xl shadow-rose-950/30">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-300">
            Application error
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Something went wrong.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            The error has been captured. If this device is offline, it will be
            queued locally and replayed automatically after connectivity is
            restored.
          </p>
          <p className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
            Queued error reports:{" "}
            <span className="font-semibold text-white">
              {this.state.queuedErrors}
            </span>
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="mt-6 rounded-full bg-rose-300 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-200"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }
}

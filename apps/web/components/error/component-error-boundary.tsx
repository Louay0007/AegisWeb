"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ComponentErrorBoundaryProps = {
  children: ReactNode;
  fallbackTitle?: string;
};

type ComponentErrorBoundaryState = {
  error?: Error;
};

export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  state: ComponentErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("component_error_boundary", { error, componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-destructive">
        <p className="text-xs font-semibold uppercase tracking-[0.18em]">Panel error</p>
        <h2 className="mt-2 text-lg font-semibold">
          {this.props.fallbackTitle ?? "This panel could not render."}
        </h2>
        <p className="mt-2 text-sm text-destructive/85">
          Retry the panel. If it happens again, include the current route and time in your report.
        </p>
        <Button
          type="button"
          className="mt-4"
          onClick={() => this.setState({ error: undefined })}
        >
          Retry panel
        </Button>
      </section>
    );
  }
}

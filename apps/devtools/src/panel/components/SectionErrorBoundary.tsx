import React from "react";

interface SectionErrorBoundaryProps {
  section: string;
  children: React.ReactNode;
}

interface SectionErrorBoundaryState {
  error: Error | null;
}

export class SectionErrorBoundary extends React.Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <section className="panel-card section-error">
          <h2>{this.props.section} — Error</h2>
          <pre className="error-details">{this.state.error.message}</pre>
          <button className="retry-button" onClick={() => this.setState({ error: null })}>
            Retry
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}

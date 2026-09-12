import React from "react";
import panelStyles from "./panelPrimitives.module.css";

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
        <section className={`${panelStyles.card} ${panelStyles.errorCard}`}>
          <h2 className={`${panelStyles.title} ${panelStyles.errorTitle}`}>
            {this.props.section} Error
          </h2>
          <pre className={panelStyles.errorDetails}>{this.state.error.message}</pre>
          <button
            className={panelStyles.retryButton}
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}

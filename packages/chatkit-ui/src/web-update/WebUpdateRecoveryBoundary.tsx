import * as React from 'react';

/** A failed lazy chunk must not unmount the update notice and recovery entry. */
export class WebUpdateRecoveryBoundary extends React.Component<
  React.PropsWithChildren<{ onError: () => void; fallback: React.ReactNode }>,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

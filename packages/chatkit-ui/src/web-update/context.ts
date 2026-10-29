import * as React from 'react';

export interface HostedWebUpdateContextValue {
  openAbout: () => void;
  registerLeave: (prepare: () => Promise<boolean>) => () => void;
}

export const HostedWebUpdateContext =
  React.createContext<HostedWebUpdateContextValue | null>(null);

export function useWebUpdateLeave(prepare: () => Promise<boolean>) {
  const update = React.useContext(HostedWebUpdateContext);
  React.useEffect(() => update?.registerLeave(prepare), [update, prepare]);
}

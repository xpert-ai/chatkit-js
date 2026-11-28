import * as React from 'react';

/** Automatic disclosure only applies until the user makes a choice. */
export function useToolDisclosure(automaticallyExpanded: boolean) {
  const [userExpanded, setUserExpanded] = React.useState<boolean>();
  const expanded = userExpanded ?? automaticallyExpanded;
  const toggle = () => setUserExpanded(!expanded);
  return [expanded, toggle, setUserExpanded] as const;
}

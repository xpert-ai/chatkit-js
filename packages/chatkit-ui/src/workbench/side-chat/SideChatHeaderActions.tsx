import * as React from 'react';
import { WorkbenchTabDropdown } from '../WorkbenchTabMenu';

export const SideChatHeaderContext = React.createContext<string | null>(null);

/** Use thread/tab operations here; conversation operations would affect the main chat. */
export function SideChatHeaderActions({
  children,
}: {
  children: React.ReactNode;
}) {
  const tabKey = React.useContext(SideChatHeaderContext);
  return (
    <>
      {children}
      {tabKey && <WorkbenchTabDropdown tabKey={tabKey} />}
    </>
  );
}

import { createContext, useContext, type ReactNode } from 'react';
import type { ChatProps } from '../chat/types';
import { useGroupChat } from './useGroupChat';
import { useGroupWorkbenchRuntime } from '../../workbench/group/useGroupWorkbenchRuntime';
import { WorkbenchRuntimeContext } from '../../workbench/WorkbenchRuntime';

const Context = createContext<ReturnType<typeof useGroupChat> | null>(null);
export const useGroupConversationState = () => useContext(Context);

/** One group subscription supplies both the original Chat and Workbench. */
export function GroupConversationProvider({
  children,
  workbench,
  ...props
}: ChatProps & { children: ReactNode; workbench?: boolean }) {
  const groupId = props.options?.group?.id ?? '';
  const state = useGroupChat({ ...props, groupId });
  return (
    <Context.Provider value={state}>
      {workbench ? (
        <WorkbenchRuntimeProvider state={state} props={props}>
          {children}
        </WorkbenchRuntimeProvider>
      ) : (
        children
      )}
    </Context.Provider>
  );
}

function WorkbenchRuntimeProvider({
  children,
  state,
  props,
}: {
  children: ReactNode;
  state: ReturnType<typeof useGroupChat>;
  props: ChatProps;
}) {
  const runtime = useGroupWorkbenchRuntime(state, props);
  return (
    <WorkbenchRuntimeContext.Provider value={runtime}>
      {children}
    </WorkbenchRuntimeContext.Provider>
  );
}

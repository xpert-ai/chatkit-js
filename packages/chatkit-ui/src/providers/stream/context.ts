import { createContext, useContext } from 'react';
import type { StreamContextType } from './types';

export const StreamContext = createContext<StreamContextType | undefined>(
  undefined,
);

export const useStreamContext = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error('useStreamContext must be used within a StreamProvider');
  }
  return context;
};

export default StreamContext;

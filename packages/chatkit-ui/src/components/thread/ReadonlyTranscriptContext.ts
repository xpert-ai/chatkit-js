import { createContext, useContext } from 'react';

/** Shared snapshots must not load private resources or dispatch host commands. */
export const ReadonlyTranscriptContext = createContext(false);
export const useReadonlyTranscript = () =>
  useContext(ReadonlyTranscriptContext);

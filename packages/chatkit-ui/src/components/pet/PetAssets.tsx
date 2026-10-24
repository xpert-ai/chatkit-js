import { createContext, useContext } from 'react';

/** Per-chat resource configuration also reaches portals and nested characters. */
export const PetAssetsContext = createContext<string | undefined>(undefined);
export const usePetAssetsBaseUrl = () => useContext(PetAssetsContext);

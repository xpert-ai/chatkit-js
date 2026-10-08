import { createContext, useContext } from 'react';
import type { ResourceCardActions } from './types';

export const unavailableResourceCardActions: ResourceCardActions = {};
export const ResourceCardContext = createContext<ResourceCardActions>(
  unavailableResourceCardActions,
);
export const useResourceCardActions = () => useContext(ResourceCardContext);

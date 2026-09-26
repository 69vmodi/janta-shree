import { createContext, useContext } from 'react';

export const BranchContext = createContext(null);

export function useBranch() {
  return useContext(BranchContext);
}
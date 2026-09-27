import React, { createContext, useState, useEffect } from 'react';

export const BranchContext = createContext();

export function BranchProvider({ children }) {
  const [selectedBranch, setSelectedBranch] = useState(() => {
    return localStorage.getItem('janta_selected_branch') || 'ALL';
  });

  const changeBranch = (newBranchId) => {
    setSelectedBranch(newBranchId);
    localStorage.setItem('janta_selected_branch', newBranchId);
  };

  return (
    <BranchContext.Provider value={{ selectedBranch, changeBranch }}>
      {children}
    </BranchContext.Provider>
  );
}
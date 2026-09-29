import { createContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export const BranchContext = createContext();

// Fallback branches so they never disappear from the dropdown
const DEFAULT_BRANCHES = [
  { id: '4b4c5e6c-87f6-46fc-892e-efb4e9a39fc8', name: 'Sanjay Shah Jobat' },
  { id: 'alirajpur-default-id', name: 'Sanjay Shah Alirajpur' }
];

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState(DEFAULT_BRANCHES);
  const [selectedBranch, setSelectedBranch] = useState('ALL');

  useEffect(() => {
    loadBranches();
  }, []);

  async function loadBranches() {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (!error && data && data.length > 0) {
        setBranches(data);
        // Default to first branch if desired, or keep as 'ALL'
      } else {
        console.warn('Using fallback branches:', error?.message);
        setBranches(DEFAULT_BRANCHES);
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
      setBranches(DEFAULT_BRANCHES);
    }
  }

  return (
    <BranchContext.Provider
      value={{
        branches,
        selectedBranch,
        setSelectedBranch
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}
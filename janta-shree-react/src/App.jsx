import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { BranchContext } from './BranchContext';

import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import Transfers from './pages/Transfers';
import Purchases from './pages/Purchases';
import Sales from './pages/Sales';
import Invoices from './pages/Invoices';
import Parties from './pages/Parties';
import CashBank from './pages/CashBank';
import Reports from './pages/Reports';
import Login from './pages/Login';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Read immediately from localStorage
  const [selectedBranch, setSelectedBranch] = useState(() => {
    return localStorage.getItem('janta_selected_branch') || 'ALL';
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleBranchChange = (branchId) => {
    setSelectedBranch(branchId);
    localStorage.setItem('janta_selected_branch', branchId);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: '#fff' }}>
        Loading Janta Shree...
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={() => setLoading(false)} />;
  }

  return (
    <BranchContext.Provider value={{ selectedBranch, changeBranch: handleBranchChange }}>
      <div className="layout">
        <Sidebar onBranchSelect={handleBranchChange} currentBranch={selectedBranch} />
        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/items" element={<Items />} />
            <Route path="/transfers" element={<Transfers />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/parties" element={<Parties />} />
            <Route path="/cash-bank" element={<CashBank />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </BranchContext.Provider>
  );
}

export default App;

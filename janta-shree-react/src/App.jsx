import { useState, useEffect, useContext } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { BranchContext } from './BranchContext';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import Transfers from './pages/Transfers';
import Purchases from './pages/Purchases';
import Sales from './pages/Sales';
import Invoices from './pages/Invoices';
import Parties from './pages/Parties';
import Reports from './pages/Reports';

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { selectedBranch, setSelectedBranch, branches } = useContext(BranchContext);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        Loading Janta Shree...
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={() => supabase.auth.getSession().then(({ data: { session } }) => setSession(session))} />;
  }

  return (
    <div className="layout">
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div className="brand">JANTA SHREE</div>

        <div className="branch-select-box">
          <label>BRANCH VIEW</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="ALL">🏢 Consolidated (All)</option>
            {(branches || []).map((b) => (
              <option key={b.id} value={b.id}>
                📍 {b.name}
              </option>
            ))}
          </select>
        </div>

        <nav className="nav-links">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/items">Items & Stock</NavLink>
          <NavLink to="/transfers">Stock Transfer</NavLink>
          <NavLink to="/purchases">Purchases</NavLink>
          <NavLink to="/sales">Sales / Billing</NavLink>
          <NavLink to="/invoices">Invoices / Bills</NavLink>
          <NavLink to="/parties">Parties</NavLink>
          <NavLink to="/reports">Reports</NavLink>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/items" element={<Items />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/parties" element={<Parties />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
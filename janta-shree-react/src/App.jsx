import Invoices from './pages/Invoices';
import Transfers from './pages/Transfers';
import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { BranchContext } from './BranchContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import Purchases from './pages/Purchases';
import Sales from './pages/Sales';
import Parties from './pages/Parties';
import CashBank from './pages/CashBank';
import Reports from './pages/Reports';
import Login from './pages/Login';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setSelectedBranch(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const { data: branchesData } = await supabase
      .from('branches')
      .select('*')
      .order('name');

    setProfile(profileData);
    setBranches(branchesData || []);

    if (profileData?.role === 'staff') {
      // Locked strictly to staff's assigned branch
      setSelectedBranch(profileData.branch_id);
    } else {
      // Owner starts with the first branch
      setSelectedBranch(branchesData?.[0]?.id || null);
    }

    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSelectedBranch(null);
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        Loading Janta Shree...
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <BranchContext.Provider value={selectedBranch}>
      <div className="layout">
        <Sidebar
          onLogout={handleLogout}
          profile={profile}
          branches={branches}
          selectedBranch={selectedBranch}
          onBranchChange={setSelectedBranch}
        />
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/items" element={<Items />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/parties" element={<Parties />} />
            <Route path="/cashbank" element={<CashBank />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/transfers" element={<Transfers />} />
            <Route path="/invoices" element={<Invoices />} />
          </Routes>
        </div>
      </div>
    </BranchContext.Provider>
  );
}

export default App;
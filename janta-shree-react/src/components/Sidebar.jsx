import { useEffect, useState, useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Sidebar() {
  const { selectedBranch, changeBranch } = useContext(BranchContext);
  const [branches, setBranches] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadBranches() {
      const { data, error } = await supabase.from('branches').select('*').order('name');
      if (!error && data) {
        setBranches(data);
      }
    }
    loadBranches();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    <aside className="sidebar">
      <div className="brand">JANTA SHREE</div>

      <div className="branch-select-box">
        <label>BRANCH VIEW</label>
        <select
          value={selectedBranch || 'ALL'}
          onChange={(e) => changeBranch(e.target.value)}
        >
          <option value="ALL">🏢 All Branches (Overview)</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              📍 {b.name}
            </option>
          ))}
        </select>
      </div>

      <nav className="nav-links">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/items">Items & Stock</NavLink>
        <NavLink to="/transfers">Stock Transfer</NavLink>
        <NavLink to="/purchases">Purchases</NavLink>
        <NavLink to="/sales">Sales / Billing</NavLink>
        <NavLink to="/invoices">Invoices / Bills</NavLink>
        <NavLink to="/parties">Parties</NavLink>
        <NavLink to="/cash-bank">Cash & Bank</NavLink>
        <NavLink to="/reports">Reports</NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
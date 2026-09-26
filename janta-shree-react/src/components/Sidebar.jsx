import { Link, useLocation } from 'react-router-dom';

function Sidebar({ onLogout, profile, branches, selectedBranch, onBranchChange }) {
  const location = useLocation();
  const isOwner = profile?.role === 'owner';

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/items', label: 'Items & Stock' },
    { path: '/transfers', label: 'Stock Transfer' },
    { path: '/purchases', label: 'Purchases' },
    { path: '/sales', label: 'Sales / Billing' },
    { path: '/invoices', label: 'Invoices / Bills' },
    { path: '/parties', label: 'Parties' },
    { path: '/cashbank', label: 'Cash & Bank' },
    { path: '/reports', label: 'Reports' },
  ];

  return (
    <div className="sidebar">
      <div className="brand">Janta Shree</div>

      {isOwner && branches && branches.length > 0 && (
        <div className="branch-select-box">
          <label>Branch View</label>
          <select
            value={selectedBranch || ''}
            onChange={(e) => onBranchChange(e.target.value)}
          >
            <option value="ALL">🏢 All Branches (Combined)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                📍 {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="nav-links">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={location.pathname === item.path ? 'active' : ''}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Dashboard() {
  const { selectedBranch } = useContext(BranchContext);

  const currentBranchId =
    typeof selectedBranch === 'object' && selectedBranch !== null
      ? selectedBranch.selectedBranch
      : selectedBranch;

  const isAllBranches = !currentBranchId || currentBranchId === 'ALL';

  const [todayCash, setTodayCash] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [stockValue, setStockValue] = useState(0);
  const [lowStockItems, setLowStockItems] = useState([]);

  useEffect(() => {
    loadDashboardMetrics();
  }, [currentBranchId]);

  async function loadDashboardMetrics() {
    // 1. Fetch Today's Cash (from sales and cash_entries today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let salesQuery = supabase
      .from('sales')
      .select('total, payment_type, created_at')
      .gte('created_at', todayStart.toISOString());

    let cashQuery = supabase
      .from('cash_entries')
      .select('amount, type, created_at')
      .gte('created_at', todayStart.toISOString());

    let partiesQuery = supabase
      .from('parties')
      .select('balance, balance_type, branch_id');

    let itemsQuery = supabase
      .from('items')
      .select('*, branch:branches(name)');

    if (!isAllBranches) {
      salesQuery = salesQuery.or(`branch_id.eq.${currentBranchId},branch_id.is.null`);
      cashQuery = cashQuery.or(`branch_id.eq.${currentBranchId},branch_id.is.null`);
      partiesQuery = partiesQuery.or(`branch_id.eq.${currentBranchId},branch_id.is.null`);
      itemsQuery = itemsQuery.or(`branch_id.eq.${currentBranchId},branch_id.is.null`);
    }

    const [salesRes, cashRes, partiesRes, itemsRes] = await Promise.all([
      salesQuery,
      cashQuery,
      partiesQuery,
      itemsQuery
    ]);

    // Cash from counter sales today
    const salesCash = (salesRes.data || [])
      .filter((s) => s.payment_type === 'Cash')
      .reduce((sum, s) => sum + Number(s.total || 0), 0);

    // Cash from Cash entries today
    const cashIn = (cashRes.data || [])
      .filter((c) => c.type === 'IN')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const cashOut = (cashRes.data || [])
      .filter((c) => c.type === 'OUT')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    setTodayCash(salesCash + cashIn - cashOut);

    // 2. Total Due (Udhaari Only - Debit 'Dr' balances)
    const onlyDrUdhaari = (partiesRes.data || [])
      .filter((p) => (p.balance_type || 'Dr') === 'Dr')
      .reduce((sum, p) => sum + Number(p.balance || 0), 0);
    setTotalDue(onlyDrUdhaari);

    // 3. Stock Value and Low Stock List (Items with stock <= 5)
    const allItems = itemsRes.data || [];
    const totalVal = allItems.reduce(
      (sum, item) => sum + Number(item.stock || 0) * Number(item.rate || 0),
      0
    );
    setStockValue(Math.round(totalVal));

    const lowItems = allItems.filter((item) => Number(item.stock || 0) <= 5);
    setLowStockItems(lowItems);
  }

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <div className="cards">
        <div className="card">
          <div className="card-label">TODAY'S CASH</div>
          <div className="card-value" style={{ color: todayCash >= 0 ? '#047857' : '#dc2626' }}>
            ₹{todayCash.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card">
          <div className="card-label">TOTAL DUE (UDHARI ONLY)</div>
          <div className="card-value" style={{ color: '#dc2626' }}>
            ₹{totalDue.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="card">
          <div className="card-label">STOCK VALUE</div>
          <div className="card-value">₹{stockValue.toLocaleString('en-IN')}</div>
        </div>

        <div className="card" style={{ borderTopColor: lowStockItems.length > 0 ? '#dc2626' : '#10b981' }}>
          <div className="card-label">LOW STOCK ITEMS</div>
          <div className="card-value" style={{ color: lowStockItems.length > 0 ? '#dc2626' : '#10b981' }}>
            {lowStockItems.length}
          </div>
        </div>
      </div>

      {/* Low Stock Items Section */}
      <div className="form-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '16px', color: '#1e293b', margin: 0 }}>
            ⚠️ Low Stock Alert (Stock &le; 5 units)
          </h2>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>
            {lowStockItems.length} item(s) require re-order
          </span>
        </div>

        {lowStockItems.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Current Stock</th>
                <th>Rate (₹)</th>
                {isAllBranches && <th>Branch</th>}
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map((item) => (
                <tr key={item.id} style={{ backgroundColor: '#fff1f2' }}>
                  <td><strong>{item.name}</strong></td>
                  <td><span className="badge">{item.category || 'General'}</span></td>
                  <td>{item.unit || 'NOS'}</td>
                  <td style={{ fontWeight: 700, color: '#dc2626' }}>
                    {item.stock} {item.unit || ''}
                  </td>
                  <td>₹{item.rate}</td>
                  {isAllBranches && <td>{item.branch?.name || '-'}</td>}
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 700, backgroundColor: '#fee2e2', padding: '3px 8px', borderRadius: '4px' }}>
                      CRITICAL LOW
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '16px', color: '#047857', textAlign: 'center', backgroundColor: '#f0fdf4', borderRadius: '4px' }}>
            ✅ All items have sufficient stock.
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
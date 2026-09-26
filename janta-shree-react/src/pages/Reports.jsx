import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';
import { downloadCSV } from '../utils/exportCsv';

function Reports() {
  const selectedBranch = useContext(BranchContext);

  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAllBranches = selectedBranch === 'ALL';

  useEffect(() => {
    if (selectedBranch) {
      fetchReportData();
    }
  }, [selectedBranch]);

  async function fetchReportData() {
    setLoading(true);

    let salesQuery = supabase
      .from('sales')
      .select('*, branch:branches(name)')
      .order('created_at', { ascending: false });

    let purchasesQuery = supabase
      .from('purchases')
      .select('*, branch:branches(name)')
      .order('created_at', { ascending: false });

    let itemsQuery = supabase
      .from('items')
      .select('*, branch:branches(name)');

    if (!isAllBranches) {
      salesQuery = salesQuery.eq('branch_id', selectedBranch);
      purchasesQuery = purchasesQuery.eq('branch_id', selectedBranch);
      itemsQuery = itemsQuery.eq('branch_id', selectedBranch);
    }

    const [salesRes, purchasesRes, itemsRes] = await Promise.all([
      salesQuery,
      purchasesQuery,
      itemsQuery
    ]);

    setSales(salesRes.data || []);
    setPurchases(purchasesRes.data || []);
    setItems(itemsRes.data || []);
    setLoading(false);
  }

  const totalSalesRevenue = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const totalPurchaseCost = purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const totalInventoryValuation = items.reduce(
    (sum, i) => sum + Number(i.stock || 0) * Number(i.rate || 0),
    0
  );
  const estimatedGrossProfit = totalSalesRevenue - totalPurchaseCost;

  // CSV Export Handlers
  function exportSalesCSV() {
    const formatted = sales.map((s) => ({
      'Date': new Date(s.created_at).toLocaleDateString(),
      'Branch': s.branch?.name || 'Main',
      'Invoice ID': s.id ? s.id.slice(0, 8).toUpperCase() : '-',
      'Customer': s.customer,
      'Payment Mode': s.payment_type,
      'Total Amount (INR)': s.total
    }));
    downloadCSV('Janta_Shree_Sales_Report', formatted);
  }

  function exportPurchasesCSV() {
    const formatted = purchases.map((p) => ({
      'Date': new Date(p.created_at).toLocaleDateString(),
      'Branch': p.branch?.name || 'Main',
      'Supplier': p.supplier,
      'Item': p.item_name,
      'Quantity': p.quantity,
      'Unit': p.unit,
      'Rate (INR)': p.rate,
      'Total (INR)': p.total
    }));
    downloadCSV('Janta_Shree_Purchases_Report', formatted);
  }

  function exportStockCSV() {
    const formatted = items.map((i) => ({
      'Branch': i.branch?.name || 'Main',
      'Item Name': i.name,
      'Category': i.category,
      'Stock Quantity': i.stock,
      'Unit': i.unit,
      'Selling Rate (INR)': i.rate,
      'Total Valuation (INR)': Number(i.stock) * Number(i.rate)
    }));
    downloadCSV('Janta_Shree_Stock_Valuation', formatted);
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>
          Business Reports{' '}
          {isAllBranches && (
            <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>
              (Consolidated)
            </span>
          )}
        </h1>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportSalesCSV} style={{ fontSize: '12px', height: '34px' }}>
            📥 Export Sales (.CSV)
          </button>
          <button onClick={exportPurchasesCSV} className="btn-secondary" style={{ fontSize: '12px', height: '34px' }}>
            📥 Export Purchases (.CSV)
          </button>
          <button onClick={exportStockCSV} className="btn-secondary" style={{ fontSize: '12px', height: '34px' }}>
            📥 Export Stock (.CSV)
          </button>
        </div>
      </div>

      <div className="cards">
        <div className="card card-blue">
          <p className="card-label">Total Sales</p>
          <p className="card-value">₹{totalSalesRevenue.toLocaleString('en-IN')}</p>
        </div>
        <div className="card">
          <p className="card-label">Total Purchases</p>
          <p className="card-value">₹{totalPurchaseCost.toLocaleString('en-IN')}</p>
        </div>
        <div className="card">
          <p className="card-label">Stock Valuation</p>
          <p className="card-value">₹{totalInventoryValuation.toLocaleString('en-IN')}</p>
        </div>
        <div className="card card-blue">
          <p className="card-label">Est. Gross Profit</p>
          <p className="card-value" style={{ color: estimatedGrossProfit >= 0 ? '#047857' : '#dc2626' }}>
            ₹{estimatedGrossProfit.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <h1 style={{ fontSize: '16px', marginTop: '28px' }}>Recent Sales Summary</h1>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            {isAllBranches && <th>Branch</th>}
            <th>Customer</th>
            <th>Payment</th>
            <th>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {sales.slice(0, 10).map((s) => (
            <tr key={s.id}>
              <td>{new Date(s.created_at).toLocaleDateString()}</td>
              {isAllBranches && <td><strong>{s.branch?.name || '-'}</strong></td>}
              <td>{s.customer}</td>
              <td><span className="badge">{s.payment_type}</span></td>
              <td style={{ fontWeight: 600 }}>₹{s.total}</td>
            </tr>
          ))}
          {sales.length === 0 && (
            <tr>
              <td colSpan={isAllBranches ? 5 : 4} style={{ textAlign: 'center', color: '#888', padding: '16px' }}>
                No sales data recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Reports;
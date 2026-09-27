import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Reports() {
  const { selectedBranch } = useContext(BranchContext);

  const [totalSales, setTotalSales] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [stockValuation, setStockValuation] = useState(0);
  const [recentSales, setRecentSales] = useState([]);

  useEffect(() => {
    if (selectedBranch) {
      fetchReportData();
    }
  }, [selectedBranch]);

  async function fetchReportData() {
    try {
      // 1. Sales Calculation
      let salesQuery = supabase.from('sales').select('*, branch:branches(name)').order('created_at', { ascending: false });
      if (selectedBranch !== 'ALL') {
        salesQuery = salesQuery.eq('branch_id', selectedBranch);
      }
      const { data: sales } = await salesQuery;

      if (sales) {
        const salesSum = sales.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
        setTotalSales(salesSum);
        setRecentSales(sales.slice(0, 15));
      }

      // 2. Purchases Calculation
      let purchasesQuery = supabase.from('purchases').select('*');
      if (selectedBranch !== 'ALL') {
        purchasesQuery = purchasesQuery.eq('branch_id', selectedBranch);
      }
      const { data: purchases } = await purchasesQuery;

      if (purchases) {
        const purchSum = purchases.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
        setTotalPurchases(purchSum);
      }

      // 3. Stock Valuation
      let itemsQuery = supabase.from('items').select('*');
      if (selectedBranch !== 'ALL') {
        itemsQuery = itemsQuery.eq('branch_id', selectedBranch);
      }
      const { data: items } = await itemsQuery;

      if (items) {
        const stockVal = items.reduce(
          (sum, item) => sum + (Number(item.stock || 0) * Number(item.rate || 0)),
          0
        );
        setStockValuation(Math.round(stockVal));
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  }

  function exportSalesCSV() {
    if (recentSales.length === 0) return alert('No sales data to export.');
    const headers = 'Invoice No,Date,Customer,Payment,Amount\n';
    const rows = recentSales.map(s => 
      `"${s.invoice_no || s.id}","${new Date(s.created_at).toLocaleDateString()}","${s.customer}","${s.payment_type}",${s.total}`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Janta_Shree_Sales_Report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Business Reports</h1>
        <button onClick={exportSalesCSV} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '13px' }}>
          📥 Export Sales (.CSV)
        </button>
      </div>

      <div className="cards">
        <div className="card">
          <div className="card-label">TOTAL SALES</div>
          <div className="card-value">₹{totalSales.toLocaleString('en-IN')}</div>
        </div>

        <div className="card card-blue">
          <div className="card-label">TOTAL PURCHASES</div>
          <div className="card-value">₹{totalPurchases.toLocaleString('en-IN')}</div>
        </div>

        <div className="card">
          <div className="card-label">STOCK VALUATION</div>
          <div className="card-value">₹{stockValuation.toLocaleString('en-IN')}</div>
        </div>

        <div className="card card-blue">
          <div className="card-label">EST. GROSS PROFIT</div>
          <div className="card-value">₹{(totalSales - totalPurchases).toLocaleString('en-IN')}</div>
        </div>
      </div>

      <h2 style={{ fontSize: '16px', margin: '20px 0 12px', color: '#1e293b' }}>Recent Sales Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Invoice No</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Payment</th>
            <th>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {recentSales.map((s) => (
            <tr key={s.id}>
              <td><strong>{s.invoice_no || `JS-${s.id.slice(0, 6)}`}</strong></td>
              <td>{new Date(s.created_at).toLocaleDateString('en-GB')}</td>
              <td>{s.customer}</td>
              <td><span className="badge">{s.payment_type}</span></td>
              <td>₹{Number(s.total || 0).toLocaleString('en-IN')}</td>
            </tr>
          ))}
          {recentSales.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', color: '#888', padding: '16px' }}>
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
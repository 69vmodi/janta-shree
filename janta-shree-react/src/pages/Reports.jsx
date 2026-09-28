import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Reports() {
  const { selectedBranch } = useContext(BranchContext);

  const [sales, setSales] = useState([]);
  const [items, setItems] = useState([]);
  const [parties, setParties] = useState([]);

  // Date filters for sales export
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st day of current month
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadData();
  }, [selectedBranch]);

  async function loadData() {
    let salesQuery = supabase.from('sales').select('*, branch:branches(*)').order('created_at', { ascending: false });
    let itemsQuery = supabase.from('items').select('*').order('name');
    let partiesQuery = supabase.from('parties').select('*').order('name');

    if (selectedBranch && selectedBranch !== 'ALL') {
      salesQuery = salesQuery.or(`branch_id.eq.${selectedBranch},branch_id.is.null`);
      itemsQuery = itemsQuery.or(`branch_id.eq.${selectedBranch},branch_id.is.null`);
      partiesQuery = partiesQuery.or(`branch_id.eq.${selectedBranch},branch_id.is.null`);
    }

    const [salesRes, itemsRes, partiesRes] = await Promise.all([
      salesQuery,
      itemsQuery,
      partiesQuery
    ]);

    if (salesRes.data) setSales(salesRes.data);
    if (itemsRes.data) setItems(itemsRes.data);
    if (partiesRes.data) setParties(partiesRes.data);
  }

  function downloadCSV(filename, csvContent) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportSalesCSVDateWise() {
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const filteredSales = sales.filter((s) => {
      const saleDate = new Date(s.created_at);
      return saleDate >= start && saleDate <= end;
    });

    if (filteredSales.length === 0) {
      return alert(`No sales found between ${fromDate} and ${toDate}.`);
    }

    const headers = ['Invoice No', 'Date', 'Customer Name', 'Phone', 'Payment Type', 'Freight (INR)', 'Total (INR)'];
    const rows = filteredSales.map((s) => [
      `"${s.invoice_no || s.id}"`,
      `"${new Date(s.created_at).toLocaleDateString('en-GB')}"`,
      `"${s.customer || ''}"`,
      `"${s.customer_phone || ''}"`,
      `"${s.payment_type || ''}"`,
      s.freight_charge || 0,
      s.total || 0
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCSV(`Sales_Report_${fromDate}_to_${toDate}.csv`, csv);
  }

  function exportStockCSV() {
    const headers = ['Item Name', 'Category', 'Unit', 'Stock Qty', 'Rate (INR)'];
    const rows = items.map((i) => [
      `"${i.name}"`,
      `"${i.category || 'General'}"`,
      `"${i.unit || ''}"`,
      i.stock || 0,
      i.rate || 0
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCSV(`Stock_Inventory_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  function exportPartiesCSV() {
    const headers = ['Party Name', 'Phone', 'Address', 'Balance (INR)', 'Khata Type'];
    const rows = parties.map((p) => [
      `"${p.name}"`,
      `"${p.phone || ''}"`,
      `"${p.address || ''}"`,
      p.balance || 0,
      `"${p.balance_type || 'Dr'}"`
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCSV(`Parties_Khata_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  const totalSalesVal = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const totalFreightVal = sales.reduce((sum, s) => sum + Number(s.freight_charge || 0), 0);
  const totalUdhaariVal = parties
    .filter((p) => (p.balance_type || 'Dr') === 'Dr')
    .reduce((sum, p) => sum + Number(p.balance || 0), 0);

  return (
    <div className="page">
      <h1>Reports & Business Intelligence</h1>

      <div className="cards">
        <div className="card">
          <div className="card-label">Total Recorded Sales</div>
          <div className="card-value">₹{totalSalesVal.toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="card-label">Total Freight Collected</div>
          <div className="card-value">₹{totalFreightVal.toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="card-label">Total Market Udhaari (Dr.)</div>
          <div className="card-value" style={{ color: '#dc2626' }}>₹{totalUdhaariVal.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Date-wise Sales Export */}
      <div className="form-box">
        <h2 style={{ fontSize: '15px', marginBottom: '14px' }}>📅 Date-Wise Sales Export (Excel / CSV)</h2>
        <div className="form-row">
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
              FROM DATE
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
              TO DATE
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <button onClick={exportSalesCSVDateWise} style={{ height: '38px', alignSelf: 'flex-end' }}>
            📥 Download Date-Wise Sales (.CSV)
          </button>
        </div>
      </div>

      {/* Master Data Exports */}
      <div className="form-box">
        <h2 style={{ fontSize: '15px', marginBottom: '14px' }}>📦 Master Data Downloads</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={exportStockCSV} style={{ backgroundColor: '#0284c7' }}>
            📦 Export Stock Inventory (.CSV)
          </button>
          <button onClick={exportPartiesCSV} style={{ backgroundColor: '#7c3aed' }}>
            👥 Export Parties & Khata (.CSV)
          </button>
        </div>
      </div>
    </div>
  );
}

export default Reports;
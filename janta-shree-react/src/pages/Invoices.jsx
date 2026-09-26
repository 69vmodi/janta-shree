import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Invoices() {
  const selectedBranch = useContext(BranchContext);

  const [sales, setSales] = useState([]);
  const [branches, setBranches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState('ALL');
  const [activeInvoice, setActiveInvoice] = useState(null);

  const isAllBranches = selectedBranch === 'ALL';

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchSales();
    }
  }, [selectedBranch]);

  async function fetchBranches() {
    const { data } = await supabase.from('branches').select('*');
    setBranches(data || []);
  }

  async function fetchSales() {
    let query = supabase
      .from('sales')
      .select('*, branch:branches(*)')
      .order('created_at', { ascending: false });

    if (!isAllBranches) {
      query = query.eq('branch_id', selectedBranch);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching sales history:', error);
      return;
    }
    setSales(data || []);
  }

  function handleOpenInvoice(sale) {
    const createdDate = new Date(sale.created_at);
    const branchRecord = sale.branch || branches.find((b) => b.id === sale.branch_id);

    const lines = Array.isArray(sale.lines) ? sale.lines : [];
    const taxable = lines.reduce((sum, l) => sum + (l.taxableAmount || (l.amount ? l.amount * 0.847 : 0)), 0);
    const cgst = lines.reduce((sum, l) => sum + (l.cgst || 0), 0);
    const sgst = lines.reduce((sum, l) => sum + (l.sgst || 0), 0);

    setActiveInvoice({
      id: sale.id ? sale.id.slice(0, 8).toUpperCase() : 'BILL',
      date: createdDate.toLocaleDateString(),
      time: createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      branchName: branchRecord?.name || 'Janta Shree',
      legalName: branchRecord?.legal_name || 'SANJAY SHAH',
      branchGstin: branchRecord?.gstin || '23AUZPS6034K2ZV',
      branchAddress: branchRecord?.address || 'Madhya Pradesh',
      customer: sale.customer,
      paymentType: sale.payment_type,
      lines: lines,
      taxable: taxable,
      cgst: cgst,
      sgst: sgst,
      total: sale.total
    });
  }

  function handlePrint() {
    window.print();
  }

  function handleCloseInvoice() {
    setActiveInvoice(null);
  }

  const filteredSales = sales.filter((s) => {
    const matchesCustomer = (s.customer || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPayment = filterPayment === 'ALL' || s.payment_type === filterPayment;
    return matchesCustomer && matchesPayment;
  });

  return (
    <div className="page">
      <h1>
        Invoice History{' '}
        {isAllBranches && (
          <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>
            (All Branches View)
          </span>
        )}
      </h1>

      <div className="form-row">
        <input
          type="text"
          placeholder="Search by customer name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}>
          <option value="ALL">All Payment Types</option>
          <option value="Cash">Cash Only</option>
          <option value="Credit">Credit Only</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date & Time</th>
            {isAllBranches && <th>Branch</th>}
            <th>Customer</th>
            <th>Items Count</th>
            <th>Type</th>
            <th>Bill Total (₹)</th>
            <th style={{ width: '120px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredSales.map((s) => (
            <tr key={s.id}>
              <td>{new Date(s.created_at).toLocaleString()}</td>
              {isAllBranches && <td><strong>{s.branch?.name || '-'}</strong></td>}
              <td>{s.customer}</td>
              <td>{Array.isArray(s.lines) ? s.lines.length : '-'} items</td>
              <td>
                <span className="badge">{s.payment_type}</span>
              </td>
              <td style={{ fontWeight: 600 }}>₹{s.total}</td>
              <td>
                <button
                  style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                  onClick={() => handleOpenInvoice(s)}
                >
                  🖨️ View / Print
                </button>
              </td>
            </tr>
          ))}
          {filteredSales.length === 0 && (
            <tr>
              <td
                colSpan={isAllBranches ? 7 : 6}
                style={{ textAlign: 'center', color: '#888', padding: '20px' }}
              >
                No invoices found matching criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Verified GST Duplicate Print Modal */}
      {activeInvoice && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal" style={{ width: '480px' }}>
            <div className="invoice-paper">
              <div className="invoice-header">
                <h2>JANTA SHREE</h2>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                  Prop: {activeInvoice.legalName} ({activeInvoice.branchName})
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                  {activeInvoice.branchAddress}
                </div>
                <div style={{ fontSize: '11px', color: '#047857', fontWeight: 700, marginTop: '2px' }}>
                  GSTIN: {activeInvoice.branchGstin}
                </div>
                <div style={{ marginTop: '8px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', fontSize: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                  TAX INVOICE / CASH MEMO (DUPLICATE)
                </div>
              </div>

              <div className="invoice-meta">
                <div>
                  <strong>Billed To:</strong> {activeInvoice.customer}
                  <br />
                  <strong>Payment Mode:</strong> {activeInvoice.paymentType}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong>Invoice No:</strong> {activeInvoice.id}
                  <br />
                  <strong>Date:</strong> {activeInvoice.date}
                  <br />
                  <strong>Time:</strong> {activeInvoice.time}
                </div>
              </div>

              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'right' }}>GST</th>
                    <th style={{ textAlign: 'right' }}>Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {activeInvoice.lines.map((line, idx) => (
                    <tr key={idx}>
                      <td>{line.name}</td>
                      <td style={{ textAlign: 'center' }}>{line.qty} {line.unit || ''}</td>
                      <td style={{ textAlign: 'right' }}>₹{line.rate}</td>
                      <td style={{ textAlign: 'right' }}>{line.gstRate || 0}%</td>
                      <td style={{ textAlign: 'right' }}>₹{Number(line.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(activeInvoice.cgst > 0 || activeInvoice.sgst > 0) && (
                <div style={{ fontSize: '11px', color: '#475569', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Taxable Amount:</span>
                    <span>₹{activeInvoice.taxable.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>CGST (Central Tax):</span>
                    <span>₹{activeInvoice.cgst.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>SGST (MP State Tax):</span>
                    <span>₹{activeInvoice.sgst.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="invoice-total-row">
                <span>Grand Total:</span>
                <span>₹{activeInvoice.total}</span>
              </div>

              <div className="invoice-footer">
                Thank you for your business!
                <br />
                Goods once sold will not be taken back without original bill.
              </div>
            </div>

            <div className="invoice-actions">
              <button onClick={handlePrint}>🖨️ Print Bill</button>
              <button className="btn-secondary" onClick={handleCloseInvoice}>
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Invoices;
import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Invoices() {
  const { selectedBranch } = useContext(BranchContext);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    loadInvoices();
  }, [selectedBranch]);

  async function loadInvoices() {
    let query = supabase.from('sales').select('*, branch:branches(*)').order('created_at', { ascending: false });
    
    // Only filter by branch if NOT 'ALL'
    if (selectedBranch && selectedBranch !== 'ALL') {
      query = query.or(`branch_id.eq.${selectedBranch},branch_id.is.null`);
    }

    const { data, error } = await query;
    if (!error && data) {
      setInvoices(data);
    }
  }

  return (
    <div className="page">
      <h1>Invoices & Billing History</h1>

      <table>
        <thead>
          <tr>
            <th>Invoice No</th>
            <th>Date</th>
            <th>Customer / Party Name</th>
            <th>Phone</th>
            <th>Payment</th>
            <th>Freight (₹)</th>
            <th>Total Amount (₹)</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td><strong>{inv.invoice_no || `JS-${inv.id.slice(0, 5)}`}</strong></td>
              <td>{new Date(inv.created_at).toLocaleDateString('en-GB')}</td>
              <td><strong>{inv.customer || 'Cash Customer'}</strong></td>
              <td>{inv.customer_phone || '-'}</td>
              <td><span className="badge">{inv.payment_type || 'Cash'}</span></td>
              <td>₹{inv.freight_charge || 0}</td>
              <td style={{ fontWeight: 700 }}>₹{Number(inv.total || 0).toLocaleString('en-IN')}</td>
              <td>
                <button
                  style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                  onClick={() => setSelectedInvoice(inv)}
                >
                  👁️ View Details
                </button>
              </td>
            </tr>
          ))}
          {invoices.length === 0 && (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', color: '#888', padding: '16px' }}>
                No invoices found for this selection.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* View Bill Details Modal */}
      {selectedInvoice && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal">
            <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>
              Invoice: {selectedInvoice.invoice_no || selectedInvoice.id}
            </h2>
            <div style={{ fontSize: '13px', color: '#475569', marginBottom: '12px' }}>
              <div><strong>Billed To:</strong> {selectedInvoice.customer || 'Cash Customer'} ({selectedInvoice.customer_phone || 'No Phone'})</div>
              <div><strong>Date:</strong> {new Date(selectedInvoice.created_at).toLocaleString('en-GB')}</div>
              <div><strong>Payment Mode:</strong> {selectedInvoice.payment_type}</div>
            </div>

            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(selectedInvoice.lines || []).map((l, idx) => (
                  <tr key={idx}>
                    <td>{l.name}</td>
                    <td style={{ textAlign: 'center' }}>{l.qty} {l.unit || ''}</td>
                    <td style={{ textAlign: 'right' }}>₹{l.rate}</td>
                    <td style={{ textAlign: 'right' }}>₹{l.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: '10px 0', borderTop: '1px dashed #cbd5e1' }}>
              <span>Grand Total (incl. ₹{selectedInvoice.freight_charge || 0} Freight):</span>
              <span>₹{selectedInvoice.total}</span>
            </div>

            <div className="invoice-actions" style={{ marginTop: '16px' }}>
              <button onClick={() => window.print()}>🖨️ Print</button>
              <button className="btn-secondary" onClick={() => setSelectedInvoice(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Invoices;
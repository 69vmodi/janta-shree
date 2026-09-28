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
    let query = supabase
      .from('sales')
      .select('*, branch:branches(*)')
      .order('created_at', { ascending: false });

    if (selectedBranch && selectedBranch !== 'ALL') {
      query = query.or(`branch_id.eq.${selectedBranch},branch_id.is.null`);
    }

    const { data, error } = await query;
    if (!error && data) {
      setInvoices(data);
    }
  }

  function handlePrintDirect() {
    const printableElement = document.getElementById('printable-bill-history');
    if (!printableElement) return;

    let iframe = document.getElementById('receipt-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'receipt-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
            body { padding: 16px; font-size: 13px; color: #000; background: #fff; line-height: 1.4; }
            .invoice-header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 10px; }
            .invoice-header h2 { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
            .invoice-meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th, td { padding: 6px 4px; font-size: 12px; text-align: left; }
            th { border-bottom: 1px dashed #000; font-weight: 700; }
            td { border-bottom: 1px solid #e2e8f0; }
            .invoice-total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 8px 0; margin: 10px 0; }
            .invoice-footer { text-align: center; font-size: 11px; color: #555; margin-top: 12px; }
            @page { margin: 6mm; size: auto; }
          </style>
        </head>
        <body>
          ${printableElement.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 250);
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
            <th style={{ textAlign: 'center' }}>Action</th>
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
              <td style={{ textAlign: 'center' }}>
                <button
                  style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                  onClick={() => setSelectedInvoice(inv)}
                >
                  👁️ View & Print
                </button>
              </td>
            </tr>
          ))}
          {invoices.length === 0 && (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
                No invoices found for this selection.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selectedInvoice && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal">
            <div className="invoice-paper" id="printable-bill-history">
              <div className="invoice-header">
                <h2>JANTA SHREE</h2>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>
                  Prop: {selectedInvoice.branch?.legal_name || 'SANJAY SHAH'} ({selectedInvoice.branch?.name || 'Janta Shree'})
                </div>
                <div style={{ fontSize: '11px', color: '#475569' }}>
                  {selectedInvoice.branch?.address || 'Madhya Pradesh'}
                </div>
                <div style={{ fontSize: '11px', color: '#047857', fontWeight: 700 }}>
                  GSTIN: {selectedInvoice.branch?.gstin || '23AUZPS6034K2ZV'}
                </div>
                <div style={{ marginTop: '8px', fontWeight: 700, fontSize: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                  TAX INVOICE / CASH MEMO
                </div>
              </div>

              <div className="invoice-meta">
                <div>
                  <strong>Billed To:</strong> {selectedInvoice.customer || 'Cash Customer'}
                  {selectedInvoice.customer_phone && <div>Mob: {selectedInvoice.customer_phone}</div>}
                  <div>Mode: {selectedInvoice.payment_type || 'Cash'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong>Invoice No:</strong> {selectedInvoice.invoice_no || selectedInvoice.id}
                  <div>Date: {new Date(selectedInvoice.created_at).toLocaleDateString('en-GB')}</div>
                  <div>Time: {new Date(selectedInvoice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
                  {(selectedInvoice.lines || []).map((line, idx) => (
                    <tr key={idx}>
                      <td>{line.name}</td>
                      <td style={{ textAlign: 'center' }}>{line.qty} {line.unit || ''}</td>
                      <td style={{ textAlign: 'right' }}>₹{line.rate}</td>
                      <td style={{ textAlign: 'right' }}>{line.gstRate || 0}%</td>
                      <td style={{ textAlign: 'right' }}>₹{Number(line.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ fontSize: '11px', color: '#475569', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                {Number(selectedInvoice.freight_charge || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Freight / Bhada:</span>
                    <span>₹{Number(selectedInvoice.freight_charge).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="invoice-total-row">
                <span>Grand Total:</span>
                <span>₹{Number(selectedInvoice.total || 0).toLocaleString('en-IN')}</span>
              </div>

              <div className="invoice-footer">
                Thank you for shopping with Janta Shree!
              </div>
            </div>

            <div className="invoice-actions">
              <button onClick={handlePrintDirect}>🖨️ Print Bill</button>
              <button className="btn-secondary" onClick={() => setSelectedInvoice(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Invoices;
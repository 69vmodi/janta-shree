import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Sales() {
  const { selectedBranch } = useContext(BranchContext);

  const [branchInfo, setBranchInfo] = useState(null);
  const [items, setItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentType, setPaymentType] = useState('Cash');
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [gstRate, setGstRate] = useState(0);
  const [freight, setFreight] = useState('');
  const [billLines, setBillLines] = useState([]);
  const [allSalesHistory, setAllSalesHistory] = useState([]);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const isAllBranches = !selectedBranch || selectedBranch === 'ALL';

  useEffect(() => {
    if (selectedBranch) {
      if (isAllBranches) {
        fetchAllSalesHistory();
      } else {
        fetchBranchDetails();
        fetchItems();
      }
    }
  }, [selectedBranch]);

  async function fetchBranchDetails() {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('id', selectedBranch)
      .maybeSingle();

    setBranchInfo(data || null);
  }

  async function fetchItems() {
    let query = supabase.from('items').select('*').order('name');
    if (!isAllBranches) {
      query = query.or(`branch_id.eq.${selectedBranch},branch_id.is.null`);
    }

    const { data, error } = await query;
    if (!error && data) {
      setItems(data);
      if (data.length > 0) {
        setSelectedItem(data[0].name);
        setCustomRate(data[0].rate != null ? data[0].rate : '');
      } else {
        setSelectedItem('');
        setCustomRate('');
      }
    }
  }

  async function fetchAllSalesHistory() {
    const { data } = await supabase
      .from('sales')
      .select('*, branch:branches(*)')
      .order('created_at', { ascending: false })
      .limit(30);

    setAllSalesHistory(data || []);
  }

  function handleItemSelect(name) {
    setSelectedItem(name);
    const item = items.find((i) => i.name === name);
    if (item && item.rate != null) {
      setCustomRate(item.rate);
    }
  }

  function handleAddLine() {
    const item = items.find((i) => i.name === selectedItem);
    if (!item || !quantity) return;

    const qty = Number(quantity);
    if (qty <= 0) return alert('Enter a valid quantity.');

    const rate = Number(customRate);
    if (isNaN(rate) || rate < 0) return alert('Enter a valid rate.');

    const alreadyInBill = billLines
      .filter((line) => line.name === item.name)
      .reduce((sum, line) => sum + line.qty, 0);

    if (qty + alreadyInBill > Number(item.stock)) {
      alert(`Only ${item.stock - alreadyInBill} ${item.unit} available in stock.`);
      return;
    }

    const taxableAmount = qty * rate;
    const taxAmount = (taxableAmount * gstRate) / 100;
    const lineTotal = taxableAmount + taxAmount;

    setBillLines([
      ...billLines,
      {
        name: item.name,
        unit: item.unit,
        qty: qty,
        rate: rate,
        gstRate: gstRate,
        taxableAmount: taxableAmount,
        cgst: taxAmount / 2,
        sgst: taxAmount / 2,
        amount: lineTotal
      }
    ]);

    setQuantity('');
  }

  function handleUpdateLineRate(index, newRate) {
    const rate = Number(newRate) || 0;
    setBillLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const taxableAmount = line.qty * rate;
        const taxAmount = (taxableAmount * (line.gstRate || 0)) / 100;
        return {
          ...line,
          rate: rate,
          taxableAmount: taxableAmount,
          cgst: taxAmount / 2,
          sgst: taxAmount / 2,
          amount: taxableAmount + taxAmount
        };
      })
    );
  }

  function handleRemoveLine(index) {
    setBillLines(billLines.filter((_, i) => i !== index));
  }

  const subTotalTaxable = billLines.reduce((sum, l) => sum + (l.taxableAmount || l.amount), 0);
  const totalCgst = billLines.reduce((sum, l) => sum + (l.cgst || 0), 0);
  const totalSgst = billLines.reduce((sum, l) => sum + (l.sgst || 0), 0);
  const freightAmount = Number(freight) || 0;
  const grandTotal = Math.round(billLines.reduce((sum, l) => sum + l.amount, 0) + freightAmount);

  async function getNextSequentialBillNumber() {
    const { count, error } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true });

    const nextCount = (error || count == null ? 0 : count) + 1;
    return `JS-${String(nextCount).padStart(4, '0')}`;
  }

  async function handleSaveSale() {
    if (!customerName.trim()) return alert('Please enter customer name.');
    if (!selectedBranch || isAllBranches) return alert('Select a specific branch (Jobat or Alirajpur) from the sidebar.');

    setIsSaving(true);

    try {
      const nextInvoiceNo = await getNextSequentialBillNumber();

      for (const item of items) {
        const totalSold = billLines
          .filter((l) => l.name === item.name)
          .reduce((sum, l) => sum + l.qty, 0);

        if (totalSold === 0) continue;

        await supabase
          .from('items')
          .update({ stock: Number(item.stock) - totalSold })
          .eq('id', item.id);
      }

      const { error: saleError } = await supabase
        .from('sales')
        .insert([
          {
            invoice_no: nextInvoiceNo,
            customer: customerName.trim(),
            customer_phone: customerPhone.trim() || null,
            payment_type: paymentType,
            lines: billLines,
            freight_charge: freightAmount,
            total: grandTotal,
            branch_id: selectedBranch
          }
        ]);

      if (saleError) throw new Error(saleError.message);

      const isCredit = paymentType === 'Credit';
      const balanceDelta = isCredit ? grandTotal : 0;

      const { data: existingParty } = await supabase
        .from('parties')
        .select('*')
        .eq('name', customerName.trim())
        .eq('branch_id', selectedBranch)
        .maybeSingle();

      if (existingParty) {
        await supabase
          .from('parties')
          .update({
            balance: Number(existingParty.balance || 0) + balanceDelta,
            phone: customerPhone.trim() || existingParty.phone
          })
          .eq('id', existingParty.id);
      } else {
        await supabase.from('parties').insert([
          {
            name: customerName.trim(),
            phone: customerPhone.trim() || null,
            type: 'customer',
            balance: balanceDelta,
            balance_type: 'Dr',
            branch_id: selectedBranch
          }
        ]);
      }

      setActiveInvoice({
        id: nextInvoiceNo,
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        branchName: branchInfo?.name || 'Janta Shree',
        legalName: branchInfo?.legal_name || 'SANJAY SHAH',
        branchGstin: branchInfo?.gstin || '23AUZPS6034K2ZV',
        branchAddress: branchInfo?.address || 'Madhya Pradesh',
        customer: customerName,
        customerPhone: customerPhone,
        paymentType: paymentType,
        lines: [...billLines],
        taxable: subTotalTaxable,
        cgst: totalCgst,
        sgst: totalSgst,
        freight: freightAmount,
        total: grandTotal
      });

      setBillLines([]);
      setCustomerName('');
      setCustomerPhone('');
      setFreight('');
      fetchItems();
    } catch (err) {
      console.error(err);
      alert('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function handlePrint() {
    const printableElement = document.getElementById('printable-bill');
    if (!printableElement) return;

    const printWindow = window.open('', '_blank', 'width=450,height=700');
    if (!printWindow) {
      alert('Please allow popups to print invoices.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${activeInvoice.id}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
            body { padding: 16px; color: #000; background: #fff; font-size: 13px; line-height: 1.4; }
            .invoice-header { text-align: center; border-bottom: 1px dashed #64748b; padding-bottom: 10px; margin-bottom: 10px; }
            .invoice-header h2 { font-size: 19px; font-weight: 700; margin-bottom: 2px; }
            .invoice-meta { display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th, td { padding: 5px 3px; font-size: 11.5px; text-align: left; }
            th { border-bottom: 1px dashed #64748b; font-weight: 600; }
            td { border-bottom: 1px solid #f1f5f9; }
            .invoice-total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; border-top: 1px dashed #64748b; border-bottom: 1px dashed #64748b; padding: 8px 0; margin: 10px 0; }
            .invoice-footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 12px; }
            @page { margin: 6mm; size: auto; }
          </style>
        </head>
        <body>
          ${printableElement.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  if (isAllBranches) {
    return (
      <div className="page">
        <h1>Sales & Billing (Consolidated View)</h1>
        <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '16px', borderRadius: '6px', marginBottom: '24px' }}>
          Please select a branch from the sidebar to create new bills.
        </div>
        <table>
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Payment</th>
              <th>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {allSalesHistory.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.invoice_no || `JS-${s.id.slice(0, 5)}`}</strong></td>
                <td>{new Date(s.created_at).toLocaleDateString('en-GB')}</td>
                <td>{s.customer}</td>
                <td><span className="badge">{s.payment_type}</span></td>
                <td>₹{s.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Sales / Billing</h1>

      <div className="form-row">
        <input
          type="text"
          placeholder="Customer Name *"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Customer Phone"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
        />
        <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
          <option value="Cash">Cash</option>
          <option value="Debit">Debit (Card / UPI / Online)</option>
          <option value="Credit">Credit (Udhaari)</option>
        </select>
      </div>

      <div className="form-row">
        <select value={selectedItem} onChange={(e) => handleItemSelect(e.target.value)}>
          {items.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name} ({item.stock} {item.unit} left)
            </option>
          ))}
          {items.length === 0 && <option value="">No items available</option>}
        </select>
        <input
          type="number"
          placeholder="Qty"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <input
          type="number"
          step="any"
          placeholder="Rate (₹)"
          value={customRate}
          onChange={(e) => setCustomRate(e.target.value)}
        />
        <select value={gstRate} onChange={(e) => setGstRate(Number(e.target.value))}>
          <option value={0}>0% GST</option>
          <option value={5}>5% GST</option>
          <option value={12}>12% GST</option>
          <option value={18}>18% GST</option>
          <option value={28}>28% GST</option>
        </select>
        <button onClick={handleAddLine} disabled={items.length === 0}>
          + Add to Bill
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Rate (₹)</th>
            <th>GST %</th>
            <th>Tax (₹)</th>
            <th>Total (₹)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {billLines.map((line, index) => (
            <tr key={index}>
              <td>{line.name}</td>
              <td>{line.qty} {line.unit}</td>
              <td>
                <input
                  type="number"
                  step="any"
                  value={line.rate}
                  onChange={(e) => handleUpdateLineRate(index, e.target.value)}
                  style={{ width: '85px', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </td>
              <td>{line.gstRate}%</td>
              <td>₹{(line.cgst + line.sgst).toFixed(2)}</td>
              <td>₹{line.amount.toFixed(2)}</td>
              <td>
                <button className="delete-btn" onClick={() => handleRemoveLine(index)}>Remove</button>
              </td>
            </tr>
          ))}
          {billLines.length === 0 && (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center', color: '#888', padding: '16px' }}>
                No items added to bill yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', margin: '14px 0' }}>
        <span style={{ fontWeight: 600 }}>🚚 Freight / Bhada (₹):</span>
        <input
          type="number"
          placeholder="0"
          value={freight}
          onChange={(e) => setFreight(e.target.value)}
          style={{ width: '130px', padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
        />
      </div>

      <div className="total-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '13px', color: '#64748b' }}>
          <span>Taxable: ₹{subTotalTaxable.toFixed(2)}</span>
          {freightAmount > 0 && <span>Freight: ₹{freightAmount.toFixed(2)}</span>}
          <span>CGST: ₹{totalCgst.toFixed(2)} | SGST: ₹{totalSgst.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '16px', fontWeight: 700 }}>
          <span>Grand Total</span>
          <span>₹{grandTotal}</span>
        </div>
      </div>

      <button className="save-btn" onClick={handleSaveSale} disabled={billLines.length === 0 || isSaving}>
        {isSaving ? 'Saving to Database...' : 'Save & Print GST Invoice'}
      </button>

      {activeInvoice && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal">
            <div className="invoice-paper" id="printable-bill">
              <div className="invoice-header">
                <h2>JANTA SHREE</h2>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>
                  Prop: {activeInvoice.legalName} ({activeInvoice.branchName})
                </div>
                <div style={{ fontSize: '11px', color: '#475569' }}>
                  {activeInvoice.branchAddress}
                </div>
                <div style={{ fontSize: '11px', color: '#047857', fontWeight: 700 }}>
                  GSTIN: {activeInvoice.branchGstin}
                </div>
                <div style={{ marginTop: '8px', fontWeight: 700, fontSize: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                  TAX INVOICE / CASH MEMO
                </div>
              </div>

              <div className="invoice-meta">
                <div>
                  <strong>Billed To:</strong> {activeInvoice.customer}
                  {activeInvoice.customerPhone && <div>Mob: {activeInvoice.customerPhone}</div>}
                  <div>Mode: {activeInvoice.paymentType}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong>Invoice No:</strong> {activeInvoice.id}
                  <div>Date: {activeInvoice.date}</div>
                  <div>Time: {activeInvoice.time}</div>
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
                      <td style={{ textAlign: 'right' }}>₹{line.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ fontSize: '11px', color: '#475569', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Taxable:</span><span>₹{activeInvoice.taxable.toFixed(2)}</span>
                </div>
                {activeInvoice.freight > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Freight / Bhada:</span><span>₹{activeInvoice.freight.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>CGST:</span><span>₹{activeInvoice.cgst.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>SGST:</span><span>₹{activeInvoice.sgst.toFixed(2)}</span>
                </div>
              </div>

              <div className="invoice-total-row">
                <span>Total Amount:</span>
                <span>₹{activeInvoice.total}</span>
              </div>

              <div className="invoice-footer">
                Thank you for shopping with Janta Shree!
              </div>
            </div>

            <div className="invoice-actions">
              <button onClick={handlePrint}>🖨️ Print GST Bill</button>
              <button className="btn-secondary" onClick={() => setActiveInvoice(null)}>
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sales;
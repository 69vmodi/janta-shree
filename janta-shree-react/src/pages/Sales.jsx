import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Sales() {
  const selectedBranch = useContext(BranchContext);

  const [branchInfo, setBranchInfo] = useState(null);
  const [items, setItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentType, setPaymentType] = useState('Cash');
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [customRate, setCustomRate] = useState(''); // Editable manual price
  const [gstRate, setGstRate] = useState(18); // Default 18% GST
  const [billLines, setBillLines] = useState([]);
  const [allSalesHistory, setAllSalesHistory] = useState([]);
  const [activeInvoice, setActiveInvoice] = useState(null);

  const isAllBranches = selectedBranch === 'ALL';

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
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('branch_id', selectedBranch)
      .order('created_at');

    if (error) {
      console.error(error);
      return;
    }

    setItems(data || []);
    if (data && data.length > 0) {
      setSelectedItem(data[0].name);
      setCustomRate(data[0].rate != null ? data[0].rate : '');
    } else {
      setSelectedItem('');
      setCustomRate('');
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
    if (qty <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    const rate = Number(customRate);
    if (isNaN(rate) || rate < 0) {
      alert('Please enter a valid rate/price.');
      return;
    }

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
  const grandTotal = Math.round(billLines.reduce((sum, l) => sum + l.amount, 0));

  async function handleSaveSale() {
    if (!customerName.trim()) {
      alert('Please enter a customer name.');
      return;
    }

    if (!selectedBranch || isAllBranches) {
      alert('Please select a specific branch to make a sale.');
      return;
    }

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

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert([
        {
          customer: customerName,
          customer_phone: customerPhone,
          payment_type: paymentType,
          lines: billLines,
          total: grandTotal,
          branch_id: selectedBranch
        }
      ])
      .select()
      .single();

    if (saleError) console.error(saleError);

    // Auto-update parties and attach phone number for credit transactions
    if (paymentType === 'Credit') {
      const { data: existing } = await supabase
        .from('parties')
        .select('*')
        .eq('name', customerName)
        .eq('type', 'customer')
        .eq('branch_id', selectedBranch)
        .maybeSingle();

      const cleanPhone = customerPhone ? customerPhone.trim().replace(/\D/g, '') : null;

      if (existing) {
        await supabase
          .from('parties')
          .update({
            balance: Number(existing.balance) + grandTotal,
            phone: cleanPhone || existing.phone
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('parties').insert([
          {
            name: customerName,
            phone: cleanPhone,
            type: 'customer',
            balance: grandTotal,
            branch_id: selectedBranch
          }
        ]);
      }
    }

    setActiveInvoice({
      id: saleData?.id?.slice(0, 8).toUpperCase() || 'BILL',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      branchName: branchInfo?.name || 'Janta Shree',
      legalName: branchInfo?.legal_name || 'SANJAY SHAH',
      branchGstin: branchInfo?.gstin || '23AUZPS6034K2ZV',
      branchAddress: branchInfo?.address || 'Madhya Pradesh',
      customer: customerName,
      customerPhone: customerPhone,
      paymentType: paymentType,
      lines: billLines,
      taxable: subTotalTaxable,
      cgst: totalCgst,
      sgst: totalSgst,
      total: grandTotal
    });

    setBillLines([]);
    setCustomerName('');
    setCustomerPhone('');
    fetchItems();
  }

  function handlePrint() {
    window.print();
  }

  function handleCloseInvoice() {
    setActiveInvoice(null);
  }

  if (isAllBranches) {
    return (
      <div className="page">
        <h1>Sales & Billing (Consolidated View)</h1>
        <div style={{
          backgroundColor: '#fff3cd',
          color: '#856404',
          padding: '16px',
          borderRadius: '6px',
          marginBottom: '24px',
          border: '1px solid #ffeeba'
        }}>
          <strong>Notice:</strong> To create a new bill, select a specific branch from the sidebar. You cannot issue bills to multiple branches at once.
        </div>

        <h1 style={{ fontSize: '16px' }}>Recent Company-Wide Sales</h1>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Branch</th>
              <th>Customer</th>
              <th>Payment</th>
              <th>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {allSalesHistory.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.created_at).toLocaleDateString()}</td>
                <td><strong>{s.branch?.name || '-'}</strong></td>
                <td>{s.customer}</td>
                <td><span className="badge">{s.payment_type}</span></td>
                <td>₹{s.total}</td>
              </tr>
            ))}
            {allSalesHistory.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: '#888', padding: '16px' }}>
                  No recent sales recorded across branches.
                </td>
              </tr>
            )}
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
          placeholder="Customer Phone (WhatsApp/SMS)"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
        />
        <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
          <option value="Cash">Cash</option>
          <option value="Credit">Credit</option>
        </select>
      </div>

      <div className="form-row">
        <select value={selectedItem} onChange={(e) => handleItemSelect(e.target.value)}>
          {items.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name} ({item.stock} {item.unit} left)
            </option>
          ))}
          {items.length === 0 && <option value="">No items in this branch</option>}
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
          placeholder="Rate / Price (₹)"
          title="Manual Selling Price per unit"
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
            <th style={{ width: '80px' }}></th>
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
                  style={{
                    width: '80px',
                    padding: '4px 6px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}
                />
              </td>
              <td>{line.gstRate}%</td>
              <td>₹{(line.cgst + line.sgst).toFixed(2)}</td>
              <td>₹{line.amount.toFixed(2)}</td>
              <td>
                <button className="delete-btn" onClick={() => handleRemoveLine(index)}>
                  Remove
                </button>
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

      <div className="total-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '13px', color: '#64748b' }}>
          <span>Taxable Amount: ₹{subTotalTaxable.toFixed(2)}</span>
          <span>CGST: ₹{totalCgst.toFixed(2)} | SGST: ₹{totalSgst.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '16px', fontWeight: 700 }}>
          <span>Grand Total</span>
          <span>₹{grandTotal}</span>
        </div>
      </div>

      <button
        className="save-btn"
        onClick={handleSaveSale}
        disabled={billLines.length === 0}
      >
        Save & Print GST Invoice
      </button>

      {/* Official Madhya Pradesh GST Bill Modal */}
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
                  TAX INVOICE / CASH MEMO
                </div>
              </div>

              <div className="invoice-meta">
                <div>
                  <strong>Billed To:</strong> {activeInvoice.customer}
                  {activeInvoice.customerPhone && <span><br />Mob: {activeInvoice.customerPhone}</span>}
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
                      <td style={{ textAlign: 'right' }}>₹{line.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ fontSize: '11px', color: '#475569', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Taxable Value:</span>
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

              <div className="invoice-total-row">
                <span>Total Amount (Rounded):</span>
                <span>₹{activeInvoice.total}</span>
              </div>

              <div className="invoice-footer">
                Thank you for shopping with Janta Shree!
                <br />
                Terms: Goods once sold will not be taken back without original bill.
              </div>
            </div>

            <div className="invoice-actions">
              <button onClick={handlePrint}>🖨️ Print GST Bill</button>
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

export default Sales;
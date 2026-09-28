import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Purchases() {
  const { selectedBranch } = useContext(BranchContext);

  const currentBranchId = typeof selectedBranch === 'object' && selectedBranch !== null 
    ? selectedBranch.selectedBranch 
    : selectedBranch;

  const isAllBranches = !currentBranchId || currentBranchId === 'ALL';

  const [existingItems, setExistingItems] = useState([]);
  const [purchases, setPurchases] = useState([]);

  // Form Fields
  const [invoiceNo, setInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendorName, setVendorName] = useState('');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('BAGS');
  const [quantity, setQuantity] = useState('');
  const [purchaseRate, setPurchaseRate] = useState('');
  const [sellingRate, setSellingRate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBranchItems();
    loadPurchases();
  }, [currentBranchId]);

  async function loadBranchItems() {
    let query = supabase.from('items').select('*').order('name');
    if (!isAllBranches) {
      query = query.or(`branch_id.eq.${currentBranchId},branch_id.is.null`);
    }
    const { data } = await query;
    setExistingItems(data || []);
  }

  async function loadPurchases() {
    let query = supabase
      .from('purchases')
      .select('*, branch:branches(name)')
      .order('created_at', { ascending: false })
      .limit(40);

    if (!isAllBranches) {
      query = query.or(`branch_id.eq.${currentBranchId},branch_id.is.null`);
    }
    const { data } = await query;
    setPurchases(data || []);
  }

  // Auto-fill when existing item is picked
  function handleItemNameChange(value) {
    setItemName(value);
    const matched = existingItems.find(
      (i) => i.name.toLowerCase() === value.trim().toLowerCase()
    );
    if (matched) {
      setCategory(matched.category || '');
      setUnit(matched.unit || 'BAGS');
      if (matched.rate) setSellingRate(matched.rate);
    }
  }

  async function handleAddPurchase(e) {
    e.preventDefault();
    if (isAllBranches) return alert('Please select a specific branch from the sidebar before entering purchases.');
    if (!itemName.trim()) return alert('Please enter or select an item name.');

    const qtyNum = Number(quantity);
    if (!qtyNum || qtyNum <= 0) return alert('Enter a valid purchase quantity.');

    const pRate = Number(purchaseRate) || 0;
    const sRate = Number(sellingRate) || pRate;
    const totalAmount = Math.round(qtyNum * pRate);

    setLoading(true);

    try {
      // 1. Record purchase entry
      const { error: pErr } = await supabase.from('purchases').insert([
        {
          invoice_no: invoiceNo.trim() || null,
          purchase_date: purchaseDate,
          vendor_name: vendorName.trim() || null,
          item_name: itemName.trim(),
          category: category.trim() || 'General',
          unit: unit || 'BAGS',
          quantity: qtyNum,
          rate: pRate,
          total: totalAmount,
          branch_id: currentBranchId
        }
      ]);

      if (pErr) throw pErr;

      // 2. Check if item already exists in this branch
      const { data: matchedItem } = await supabase
        .from('items')
        .select('*')
        .eq('branch_id', currentBranchId)
        .ilike('name', itemName.trim())
        .maybeSingle();

      if (matchedItem) {
        // Automatically increment stock
        await supabase
          .from('items')
          .update({
            stock: Number(matchedItem.stock || 0) + qtyNum,
            rate: sRate > 0 ? sRate : matchedItem.rate,
            unit: unit || matchedItem.unit
          })
          .eq('id', matchedItem.id);
      } else {
        // Create new item if it does not exist
        await supabase.from('items').insert([
          {
            name: itemName.trim(),
            category: category.trim() || 'General',
            unit: unit || 'BAGS',
            stock: qtyNum,
            rate: sRate,
            branch_id: currentBranchId
          }
        ]);
      }

      alert(`Purchase of ${qtyNum} ${unit} of "${itemName}" recorded successfully! Stock updated.`);
      setItemName('');
      setQuantity('');
      setPurchaseRate('');
      setSellingRate('');
      loadBranchItems();
      loadPurchases();
    } catch (err) {
      console.error(err);
      alert('Failed to record purchase: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Purchases / Stock Inward</h1>

      {!isAllBranches ? (
        <form onSubmit={handleAddPurchase} className="form-box">
          <h2 style={{ fontSize: '15px', marginBottom: '14px', color: '#1e293b' }}>
            + Record Inward Purchase (Add / Update Stock)
          </h2>

          {/* Invoice Details */}
          <div className="form-row">
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                PURCHASE DATE *
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                VENDOR INVOICE / BILL NO.
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-98"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                SUPPLIER / VENDOR NAME
              </label>
              <input
                type="text"
                placeholder="Vendor Name"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
              />
            </div>
          </div>

          {/* Item Details with Dropdown / Autocomplete */}
          <div className="form-row">
            <div style={{ flex: '2 1 220px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                ITEM NAME (TYPE OR PICK EXISTING) *
              </label>
              <input
                type="text"
                list="inventory-items-list"
                placeholder="Type or select existing item..."
                value={itemName}
                onChange={(e) => handleItemNameChange(e.target.value)}
                required
              />
              <datalist id="inventory-items-list">
                {existingItems.map((item) => (
                  <option key={item.id} value={item.name}>
                    Current Stock: {item.stock} {item.unit} | Category: {item.category}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                CATEGORY
              </label>
              <input
                type="text"
                placeholder="e.g. Cement, Steel"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                UNIT
              </label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="BAGS">BAGS</option>
                <option value="NOS">NOS</option>
                <option value="KG">KG</option>
                <option value="TON">TON</option>
                <option value="QUINTAL">QUINTAL</option>
                <option value="FEET">FEET</option>
                <option value="METER">METER</option>
                <option value="LITER">LITER</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                QTY *
              </label>
              <input
                type="number"
                placeholder="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                PURCHASE RATE (₹)
              </label>
              <input
                type="number"
                step="any"
                placeholder="Cost per unit"
                value={purchaseRate}
                onChange={(e) => setPurchaseRate(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                SELLING RATE (₹)
              </label>
              <input
                type="number"
                step="any"
                placeholder="Counter price"
                value={sellingRate}
                onChange={(e) => setSellingRate(e.target.value)}
              />
            </div>

            <button type="submit" disabled={loading} style={{ alignSelf: 'flex-end', height: '38px' }}>
              {loading ? 'Adding...' : '+ Record Purchase'}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '14px', borderRadius: '6px', marginBottom: '20px' }}>
          Please select a branch from the sidebar to record inward purchases.
        </div>
      )}

      <h2 style={{ fontSize: '16px', margin: '20px 0 12px 0' }}>Recent Purchases History</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Invoice No</th>
            <th>Vendor</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Purchase Rate</th>
            <th>Total Amount</th>
            {isAllBranches && <th>Branch</th>}
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => (
            <tr key={p.id}>
              <td>{p.purchase_date ? new Date(p.purchase_date).toLocaleDateString('en-GB') : new Date(p.created_at).toLocaleDateString('en-GB')}</td>
              <td><strong>{p.invoice_no || '-'}</strong></td>
              <td>{p.vendor_name || '-'}</td>
              <td><strong>{p.item_name}</strong></td>
              <td>{p.quantity} {p.unit}</td>
              <td>₹{p.rate}</td>
              <td style={{ fontWeight: 700 }}>₹{Number(p.total || 0).toLocaleString('en-IN')}</td>
              {isAllBranches && <td>{p.branch?.name || '-'}</td>}
            </tr>
          ))}
          {purchases.length === 0 && (
            <tr>
              <td colSpan={isAllBranches ? 8 : 7} style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
                No purchases recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Purchases;
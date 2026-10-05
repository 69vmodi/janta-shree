import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Purchases() {
  const { selectedBranch } = useContext(BranchContext);

  const currentBranchId =
    typeof selectedBranch === 'object' && selectedBranch !== null
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
  const [unit, setUnit] = useState('NOS');
  const [quantity, setQuantity] = useState('');
  const [purchaseRate, setPurchaseRate] = useState('');
  const [sellingRate, setSellingRate] = useState('');
  const [loading, setLoading] = useState(false);

  // Dropdown list control
  const [showItemDropdown, setShowItemDropdown] = useState(false);

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

  function handleSelectExistingItem(item) {
    setItemName(item.name);
    setCategory(item.category || '');
    setUnit(item.unit || 'NOS');
    if (item.rate) setSellingRate(item.rate);
    setShowItemDropdown(false);
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
      // 1. UPDATE ITEM STOCK FIRST
      const { data: matchedItems, error: fetchErr } = await supabase
        .from('items')
        .select('*')
        .eq('branch_id', currentBranchId)
        .ilike('name', itemName.trim());

      if (fetchErr) throw fetchErr;

      const matchedItem = matchedItems && matchedItems.length > 0 ? matchedItems[0] : null;
      let previousStock = 0;
      let newTotalStock = qtyNum;

      if (matchedItem) {
        previousStock = Number(matchedItem.stock || 0);
        newTotalStock = previousStock + qtyNum;

        const updatePayload = {
          stock: newTotalStock,
          unit: unit || matchedItem.unit
        };

        if (sRate > 0) updatePayload.rate = sRate;
        if (category.trim()) updatePayload.category = category.trim();

        const { error: updateErr } = await supabase
          .from('items')
          .update(updatePayload)
          .eq('id', matchedItem.id);

        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase.from('items').insert([
          {
            name: itemName.trim(),
            category: category.trim() || 'General',
            unit: unit || 'NOS',
            stock: qtyNum,
            rate: sRate,
            branch_id: currentBranchId
          }
        ]);

        if (insertErr) throw insertErr;
      }

      // 2. RECORD IN PURCHASES TABLE
      const purchaseEntry = {
        invoice_no: invoiceNo.trim() || null,
        purchase_date: purchaseDate,
        vendor_name: vendorName.trim() || null,
        item_name: itemName.trim(),
        item: itemName.trim(),
        unit: unit || 'NOS',
        quantity: qtyNum,
        rate: pRate,
        total: totalAmount,
        branch_id: currentBranchId
      };

      const { error: pErr } = await supabase.from('purchases').insert([purchaseEntry]);

      if (pErr && pErr.message.includes('item_name')) {
        delete purchaseEntry.item_name;
        await supabase.from('purchases').insert([purchaseEntry]);
      } else if (pErr && pErr.message.includes('item')) {
        delete purchaseEntry.item;
        await supabase.from('purchases').insert([purchaseEntry]);
      }

      alert(
        matchedItem
          ? `Stock updated!\n\nItem: ${itemName}\nPrevious Stock: ${previousStock}\nAdded Inward: ${qtyNum}\nNew Total Stock: ${newTotalStock} ${unit}`
          : `New item "${itemName}" added with ${qtyNum} ${unit} stock!`
      );

      // Reset form
      setItemName('');
      setCategory('');
      setQuantity('');
      setPurchaseRate('');
      setSellingRate('');
      loadBranchItems();
      loadPurchases();
    } catch (err) {
      console.error(err);
      alert('Error updating stock: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Delete purchase entry and optionally deduct the added stock
  async function handleDeletePurchase(purchase) {
    const targetItemName = purchase.item_name || purchase.item || 'this item';
    const qtyToDelete = Number(purchase.quantity || 0);

    const isConfirmed = window.confirm(
      `Are you sure you want to delete this purchase entry?\n\nItem: ${targetItemName}\nQty to revert: -${qtyToDelete} ${purchase.unit || ''}\n\nThis will also deduct ${qtyToDelete} ${purchase.unit || ''} from current stock.`
    );
    if (!isConfirmed) return;

    try {
      // 1. Revert stock in items table if item exists
      const branchIdToTarget = purchase.branch_id || currentBranchId;
      const { data: matchedItems } = await supabase
        .from('items')
        .select('*')
        .eq('branch_id', branchIdToTarget)
        .ilike('name', targetItemName);

      if (matchedItems && matchedItems.length > 0) {
        const itemToUpdate = matchedItems[0];
        const currentStock = Number(itemToUpdate.stock || 0);
        const revertedStock = Math.max(0, currentStock - qtyToDelete);

        await supabase
          .from('items')
          .update({ stock: revertedStock })
          .eq('id', itemToUpdate.id);
      }

      // 2. Delete the record from purchases table
      const { error: delErr } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchase.id);

      if (delErr) throw delErr;

      alert('Purchase entry deleted and stock reverted successfully.');
      loadPurchases();
      loadBranchItems();
    } catch (err) {
      console.error(err);
      alert('Failed to delete purchase: ' + err.message);
    }
  }

  const filteredDropdownItems = existingItems.filter((i) =>
    (i.name || '').toLowerCase().includes(itemName.toLowerCase())
  );

  return (
    <div className="page">
      <h1>Purchases / Stock Inward</h1>

      {!isAllBranches ? (
        <form onSubmit={handleAddPurchase} className="form-box">
          <h2 style={{ fontSize: '15px', marginBottom: '14px', color: '#1e293b' }}>
            + Record Inward Purchase (Add / Update Stock)
          </h2>

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

          <div className="form-row">
            <div style={{ flex: '2 1 240px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                ITEM NAME (TYPE OR PICK EXISTING) *
              </label>
              <input
                type="text"
                placeholder="Tap to select or type name..."
                value={itemName}
                onChange={(e) => {
                  setItemName(e.target.value);
                  setShowItemDropdown(true);
                }}
                onFocus={() => setShowItemDropdown(true)}
                required
              />

              {showItemDropdown && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 45 }}
                    onClick={() => setShowItemDropdown(false)}
                  />

                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      touchAction: 'pan-y',
                      zIndex: 50
                    }}
                  >
                    {filteredDropdownItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectExistingItem(item)}
                        style={{
                          padding: '12px 14px',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          fontSize: '13.5px',
                          userSelect: 'none',
                          WebkitUserSelect: 'none'
                        }}
                      >
                        <strong>{item.name}</strong>
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>
                          (Current Stock: {item.stock} {item.unit})
                        </span>
                      </div>
                    ))}
                    {filteredDropdownItems.length === 0 && (
                      <div style={{ padding: '12px 14px', fontSize: '12px', color: '#94a3b8' }}>
                        Press enter to create as a new item: "{itemName}"
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                CATEGORY
              </label>
              <input
                type="text"
                placeholder="e.g. Tape, Sanitary"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                UNIT
              </label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="NOS">NOS</option>
                <option value="BAGS">BAGS</option>
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
                QTY TO ADD *
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
            <th>DATE</th>
            <th>INVOICE NO</th>
            <th>VENDOR</th>
            <th>ITEM</th>
            <th>QTY ADDED</th>
            <th>PURCHASE RATE</th>
            <th>TOTAL AMOUNT</th>
            {isAllBranches && <th>BRANCH</th>}
            <th style={{ textAlign: 'center' }}>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => (
            <tr key={p.id}>
              <td>{p.purchase_date ? new Date(p.purchase_date).toLocaleDateString('en-GB') : new Date(p.created_at).toLocaleDateString('en-GB')}</td>
              <td><strong>{p.invoice_no || '-'}</strong></td>
              <td>{p.vendor_name || '-'}</td>
              <td><strong>{p.item_name || p.item || '-'}</strong></td>
              <td style={{ color: '#047857', fontWeight: 700 }}>+{p.quantity} {p.unit}</td>
              <td>₹{p.rate}</td>
              <td style={{ fontWeight: 700 }}>₹{Number(p.total || 0).toLocaleString('en-IN')}</td>
              {isAllBranches && <td>{p.branch?.name || '-'}</td>}
              <td style={{ textAlign: 'center' }}>
                <button
                  onClick={() => handleDeletePurchase(p)}
                  title="Delete purchase entry and revert stock"
                  style={{
                    height: '28px',
                    padding: '0 8px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    border: '1px solid #f87171',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  🗑️ Del
                </button>
              </td>
            </tr>
          ))}
          {purchases.length === 0 && (
            <tr>
              <td colSpan={isAllBranches ? 9 : 8} style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
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
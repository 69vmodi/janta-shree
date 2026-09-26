import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Purchases() {
  const selectedBranch = useContext(BranchContext);

  const [supplierName, setSupplierName] = useState('');
  const [paymentType, setPaymentType] = useState('Cash');
  const [itemName, setItemName] = useState('');
  const [unit, setUnit] = useState('NOS');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);

  const isAllBranches = selectedBranch === 'ALL';

  useEffect(() => {
    if (selectedBranch) {
      fetchPurchases();
    }
  }, [selectedBranch]);

  async function fetchPurchases() {
    let query = supabase
      .from('purchases')
      .select('*, branch:branches(name)')
      .order('created_at', { ascending: false });

    if (!isAllBranches) {
      query = query.eq('branch_id', selectedBranch);
    }

    const { data, error } = await query;
    if (error) console.error(error);
    setPurchases(data || []);
  }

  async function handleSavePurchase() {
    if (!supplierName.trim()) {
      alert('Please enter supplier name.');
      return;
    }
    if (!itemName.trim() || !quantity || !rate) {
      alert('Please fill all item fields.');
      return;
    }
    if (isAllBranches || !selectedBranch) {
      alert('Please select a specific branch from the sidebar to record a purchase.');
      return;
    }

    const qty = Number(quantity);
    const r = Number(rate);
    const total = qty * r;

    setLoading(true);

    try {
      // 1. Insert Purchase
      const { error: purchaseError } = await supabase.from('purchases').insert([
        {
          supplier: supplierName,
          payment_type: paymentType,
          item_name: itemName,
          unit,
          quantity: qty,
          rate: r,
          total,
          branch_id: selectedBranch
        }
      ]);

      if (purchaseError) throw purchaseError;

      // 2. Increment Stock on existing item or insert if brand new
      const { data: existingItem } = await supabase
        .from('items')
        .select('*')
        .eq('branch_id', selectedBranch)
        .eq('name', itemName)
        .maybeSingle();

      if (existingItem) {
        await supabase
          .from('items')
          .update({
            stock: Number(existingItem.stock) + qty,
            rate: r
          })
          .eq('id', existingItem.id);
      } else {
        await supabase.from('items').insert([
          {
            name: itemName,
            category: 'General',
            unit,
            stock: qty,
            rate: r,
            branch_id: selectedBranch
          }
        ]);
      }

      // 3. Update party balance if Credit
      if (paymentType === 'Credit') {
        const { data: existingParty } = await supabase
          .from('parties')
          .select('*')
          .eq('name', supplierName)
          .eq('type', 'supplier')
          .eq('branch_id', selectedBranch)
          .maybeSingle();

        if (existingParty) {
          await supabase
            .from('parties')
            .update({ balance: Number(existingParty.balance) + total })
            .eq('id', existingParty.id);
        } else {
          await supabase.from('parties').insert([
            {
              name: supplierName,
              type: 'supplier',
              balance: total,
              branch_id: selectedBranch
            }
          ]);
        }
      }

      setItemName('');
      setQuantity('');
      setRate('');
      setSupplierName('');
      fetchPurchases();
    } catch (err) {
      console.error(err);
      alert('Error saving purchase: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>
        Purchases{' '}
        {isAllBranches && (
          <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>
            (Consolidated Overview)
          </span>
        )}
      </h1>

      {isAllBranches ? (
        <div
          style={{
            backgroundColor: '#fff3cd',
            color: '#856404',
            padding: '16px',
            borderRadius: '6px',
            marginBottom: '24px',
            border: '1px solid #ffeeba'
          }}
        >
          <strong>Notice:</strong> To record a purchase/inward entry, select a specific branch from the sidebar. You cannot receive inventory into all branches simultaneously.
        </div>
      ) : (
        <div className="form-box">
          <div className="form-row">
            <input
              type="text"
              placeholder="Supplier name"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="Credit">Credit</option>
            </select>
          </div>

          <div className="form-row">
            <input
              type="text"
              placeholder="Item name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="NOS">NOS</option>
              <option value="KG">KG</option>
              <option value="Liter">Liter</option>
            </select>
            <input
              type="number"
              placeholder="Quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <input
              type="number"
              placeholder="Purchase Rate (₹)"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
            <button onClick={handleSavePurchase} disabled={loading}>
              {loading ? 'Saving...' : '+ Save Purchase'}
            </button>
          </div>
        </div>
      )}

      <h1 style={{ fontSize: '16px', marginTop: '24px' }}>Purchase History</h1>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            {isAllBranches && <th>Branch</th>}
            <th>Supplier</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Rate (₹)</th>
            <th>Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => (
            <tr key={p.id}>
              <td>{new Date(p.created_at).toLocaleDateString()}</td>
              {isAllBranches && <td><strong>{p.branch?.name || '-'}</strong></td>}
              <td>{p.supplier || '-'}</td>
              <td>{p.item_name || '-'}</td>
              <td>{p.quantity ? `${p.quantity} ${p.unit || ''}` : '-'}</td>
              <td>{p.rate ? `₹${p.rate}` : '-'}</td>
              <td>₹{p.total}</td>
            </tr>
          ))}
          {purchases.length === 0 && (
            <tr>
              <td
                colSpan={isAllBranches ? 7 : 6}
                style={{ textAlign: 'center', color: '#888', padding: '16px' }}
              >
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
import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Transfers() {
  const { selectedBranch } = useContext(BranchContext);

  // Normalize selectedBranch to string ID
  const currentBranchId =
    typeof selectedBranch === 'object' && selectedBranch !== null
      ? selectedBranch.selectedBranch
      : selectedBranch;

  const [branches, setBranches] = useState([]);
  const [fromBranch, setFromBranch] = useState('');
  const [toBranch, setToBranch] = useState('');
  const [fromItems, setFromItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [transferHistory, setTransferHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBranches();
    loadTransferHistory();
  }, []);

  useEffect(() => {
    if (branches.length > 0) {
      if (currentBranchId && currentBranchId !== 'ALL') {
        setFromBranch(currentBranchId);
        const otherBranch = branches.find((b) => b.id !== currentBranchId);
        if (otherBranch) setToBranch(otherBranch.id);
      } else {
        setFromBranch(branches[0].id);
        if (branches[1]) setToBranch(branches[1].id);
      }
    }
  }, [currentBranchId, branches]);

  useEffect(() => {
    if (fromBranch) {
      loadBranchItems(fromBranch);
    }
  }, [fromBranch]);

  async function loadBranches() {
    const { data } = await supabase.from('branches').select('*').order('name');
    if (data && data.length > 0) {
      setBranches(data);
    }
  }

  async function loadBranchItems(branchId) {
    // Includes unassigned items so stock is never hidden
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .or(`branch_id.eq.${branchId},branch_id.is.null`)
      .order('name');

    setFromItems(data || []);
    if (data && data.length > 0) {
      setSelectedItemId(data[0].id);
    } else {
      setSelectedItemId('');
    }
  }

  async function loadTransferHistory() {
    const { data } = await supabase
      .from('stock_transfers')
      .select('*, from_branch:branches!from_branch_id(name), to_branch:branches!to_branch_id(name)')
      .order('created_at', { ascending: false })
      .limit(30);

    setTransferHistory(data || []);
  }

  async function handleTransfer(e) {
    e.preventDefault();

    if (!fromBranch || !toBranch) return alert('Please select both source and destination branches.');
    if (fromBranch === toBranch) return alert('Source and Destination branches cannot be the same.');

    const qty = Number(quantity);
    if (!qty || qty <= 0) return alert('Please enter a valid transfer quantity.');

    const sourceItem = fromItems.find((i) => i.id === selectedItemId);
    if (!sourceItem) return alert('Please select an item to transfer.');

    if (qty > Number(sourceItem.stock || 0)) {
      return alert(`Cannot transfer ${qty} ${sourceItem.unit || ''}. Only ${sourceItem.stock} available in ${sourceItem.name}.`);
    }

    setLoading(true);

    try {
      // 1. Deduct stock from source item
      const { error: deductErr } = await supabase
        .from('items')
        .update({ stock: Number(sourceItem.stock) - qty })
        .eq('id', sourceItem.id);

      if (deductErr) throw deductErr;

      // 2. Add or update stock at destination branch
      const { data: destItem } = await supabase
        .from('items')
        .select('*')
        .eq('branch_id', toBranch)
        .ilike('name', sourceItem.name.trim())
        .maybeSingle();

      if (destItem) {
        await supabase
          .from('items')
          .update({ stock: Number(destItem.stock || 0) + qty })
          .eq('id', destItem.id);
      } else {
        await supabase.from('items').insert([
          {
            name: sourceItem.name,
            category: sourceItem.category || 'General',
            unit: sourceItem.unit || 'NOS',
            stock: qty,
            rate: sourceItem.rate || 0,
            branch_id: toBranch
          }
        ]);
      }

      // 3. Record transfer entry
      await supabase.from('stock_transfers').insert([
        {
          from_branch_id: fromBranch,
          to_branch_id: toBranch,
          item_name: sourceItem.name,
          quantity: qty,
          unit: sourceItem.unit || 'NOS',
          notes: notes.trim() || 'Internal Branch Stock Transfer'
        }
      ]);

      alert(`Successfully transferred ${qty} ${sourceItem.unit || ''} of "${sourceItem.name}"!`);
      setQuantity('');
      setNotes('');
      loadBranchItems(fromBranch);
      loadTransferHistory();
    } catch (err) {
      console.error(err);
      alert('Transfer failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedItemObj = fromItems.find((i) => i.id === selectedItemId);

  return (
    <div className="page">
      <h1>Stock Transfer Between Branches</h1>

      <form onSubmit={handleTransfer} className="form-box">
        <h2 style={{ fontSize: '15px', marginBottom: '14px', color: '#1e293b' }}>
          Initiate Stock Transfer
        </h2>

        <div className="form-row">
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
              FROM BRANCH (SOURCE)
            </label>
            <select value={fromBranch} onChange={(e) => setFromBranch(e.target.value)} required>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
              TO BRANCH (DESTINATION)
            </label>
            <select value={toBranch} onChange={(e) => setToBranch(e.target.value)} required>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
              SELECT ITEM
            </label>
            <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} required>
              {fromItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.stock} {item.unit || ''} available)
                </option>
              ))}
              {fromItems.length === 0 && <option value="">No items available in this branch</option>}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
              TRANSFER QUANTITY {selectedItemObj ? `(Max: ${selectedItemObj.stock})` : ''}
            </label>
            <input
              type="number"
              placeholder="Qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
              REASON / NOTES
            </label>
            <input
              type="text"
              placeholder="e.g. Sent via Chhota Hathi / Tractor"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading || fromItems.length === 0} style={{ alignSelf: 'flex-end', height: '38px' }}>
            {loading ? 'Transferring...' : '📦 Transfer Stock'}
          </button>
        </div>
      </form>

      <table>
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Item Name</th>
            <th>Quantity</th>
            <th>From Branch</th>
            <th>To Branch</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {transferHistory.map((t) => (
            <tr key={t.id}>
              <td>{new Date(t.created_at).toLocaleString('en-GB')}</td>
              <td><strong>{t.item_name}</strong></td>
              <td style={{ fontWeight: 700, color: '#0284c7' }}>{t.quantity} {t.unit || ''}</td>
              <td>{t.from_branch?.name || 'Jobat'}</td>
              <td>{t.to_branch?.name || 'Alirajpur'}</td>
              <td>{t.notes || '-'}</td>
            </tr>
          ))}
          {transferHistory.length === 0 && (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
                No transfers recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Transfers;
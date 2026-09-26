import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Transfers() {
  const selectedBranch = useContext(BranchContext);

  const [branches, setBranches] = useState([]);
  const [sourceItems, setSourceItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchSourceItems();
      fetchTransferHistory();
    }
  }, [selectedBranch]);

  async function fetchBranches() {
    const { data } = await supabase.from('branches').select('*').order('name');
    setBranches(data || []);
  }

  async function fetchSourceItems() {
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('branch_id', selectedBranch)
      .gt('stock', 0)
      .order('name');

    setSourceItems(data || []);
    if (data && data.length > 0) {
      setSelectedItemId(data[0].id);
    } else {
      setSelectedItemId('');
    }
  }

  async function fetchTransferHistory() {
    const { data } = await supabase
      .from('stock_transfers')
      .select(`
        id,
        created_at,
        item_name,
        quantity,
        unit,
        note,
        from_branch:from_branch_id(name),
        to_branch:to_branch_id(name)
      `)
      .or(`from_branch_id.eq.${selectedBranch},to_branch_id.eq.${selectedBranch}`)
      .order('created_at', { ascending: false });

    setTransfers(data || []);
  }

  // Filter destination branches so user cannot transfer to the same branch
  const destinationBranches = branches.filter((b) => b.id !== selectedBranch);

  async function handleTransfer() {
    if (!selectedBranch) {
      alert('Please select a branch first.');
      return;
    }

    if (!toBranchId) {
      alert('Please select destination branch.');
      return;
    }

    const transferQty = Number(quantity);
    if (!transferQty || transferQty <= 0) {
      alert('Please enter a valid transfer quantity.');
      return;
    }

    const sourceItem = sourceItems.find((i) => i.id === selectedItemId);
    if (!sourceItem) {
      alert('Please select an item to transfer.');
      return;
    }

    if (transferQty > Number(sourceItem.stock)) {
      alert(`Cannot transfer ${transferQty} ${sourceItem.unit}. Only ${sourceItem.stock} in stock.`);
      return;
    }

    setLoading(true);

    try {
      // 1. Deduct stock from the source branch item
      const { error: deductError } = await supabase
        .from('items')
        .update({ stock: Number(sourceItem.stock) - transferQty })
        .eq('id', sourceItem.id);

      if (deductError) throw deductError;

      // 2. Check if this item already exists in the destination branch
      const { data: targetItem, error: findError } = await supabase
        .from('items')
        .select('*')
        .eq('branch_id', toBranchId)
        .eq('name', sourceItem.name)
        .maybeSingle();

      if (findError) throw findError;

      if (targetItem) {
        // Update stock in target branch
        const { error: updateTargetError } = await supabase
          .from('items')
          .update({ stock: Number(targetItem.stock) + transferQty })
          .eq('id', targetItem.id);

        if (updateTargetError) throw updateTargetError;
      } else {
        // Create new item entry in target branch
        const { error: insertTargetError } = await supabase
          .from('items')
          .insert([
            {
              name: sourceItem.name,
              unit: sourceItem.unit,
              rate: sourceItem.rate,
              stock: transferQty,
              branch_id: toBranchId
            }
          ]);

        if (insertTargetError) throw insertTargetError;
      }

      // 3. Record transfer in stock_transfers table
      const { error: logError } = await supabase.from('stock_transfers').insert([
        {
          from_branch_id: selectedBranch,
          to_branch_id: toBranchId,
          item_name: sourceItem.name,
          quantity: transferQty,
          unit: sourceItem.unit,
          note: note
        }
      ]);

      if (logError) throw logError;

      alert(`Transferred ${transferQty} ${sourceItem.unit} of ${sourceItem.name} successfully!`);
      setQuantity('');
      setNote('');
      setToBranchId('');
      fetchSourceItems();
      fetchTransferHistory();
    } catch (err) {
      console.error(err);
      alert('Error processing transfer: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Stock Transfer</h1>

      <div className="form-row">
        <select
          value={selectedItemId}
          onChange={(e) => setSelectedItemId(e.target.value)}
        >
          {sourceItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.stock} {item.unit} available)
            </option>
          ))}
          {sourceItems.length === 0 && <option value="">No stock available in this branch</option>}
        </select>

        <select
          value={toBranchId}
          onChange={(e) => setToBranchId(e.target.value)}
        >
          <option value="">-- Send to Branch --</option>
          {destinationBranches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />

        <input
          type="text"
          placeholder="Note / Dispatch reason"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <button
          onClick={handleTransfer}
          disabled={loading || sourceItems.length === 0}
        >
          {loading ? 'Transferring...' : 'Transfer Stock'}
        </button>
      </div>

      <h1 style={{ fontSize: '16px', marginTop: '24px' }}>Transfer History</h1>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Item</th>
            <th>Qty</th>
            <th>From</th>
            <th>To</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t) => (
            <tr key={t.id}>
              <td>{new Date(t.created_at).toLocaleDateString()}</td>
              <td>{t.item_name}</td>
              <td>
                {t.quantity} {t.unit}
              </td>
              <td>{t.from_branch?.name || '-'}</td>
              <td>{t.to_branch?.name || '-'}</td>
              <td>{t.note || '-'}</td>
            </tr>
          ))}
          {transfers.length === 0 && (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', color: '#888', padding: '16px' }}>
                No transfers recorded for this branch yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Transfers;
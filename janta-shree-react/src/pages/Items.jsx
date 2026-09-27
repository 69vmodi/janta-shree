import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Items() {
  const { selectedBranch } = useContext(BranchContext);

  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('BAGS');
  const [stock, setStock] = useState('');
  const [rate, setRate] = useState('');
  const [loading, setLoading] = useState(false);

  const isAllBranches = !selectedBranch || selectedBranch === 'ALL';

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchItems();
      if (!isAllBranches) {
        setTargetBranchId(selectedBranch);
      }
    }
  }, [selectedBranch]);

  async function fetchBranches() {
    const { data, error } = await supabase.from('branches').select('*').order('name');
    if (!error && data) {
      setBranches(data);
      if (data.length > 0 && !targetBranchId) {
        setTargetBranchId(data[0].id);
      }
    }
  }

  async function fetchItems() {
    let query = supabase
      .from('items')
      .select('*, branch:branches(name)')
      .order('name');

    // If specific branch is selected, fetch matching branch items OR legacy null-branch items
    if (!isAllBranches) {
      query = query.or(`branch_id.eq.${selectedBranch},branch_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching items:', error);
      return;
    }
    setItems(data || []);
  }

  async function handleAdd(e) {
    e?.preventDefault();
    if (!name.trim()) {
      alert('Please enter an item name.');
      return;
    }

    const effectiveBranchId = isAllBranches ? targetBranchId : selectedBranch;

    if (!effectiveBranchId || effectiveBranchId === 'ALL') {
      alert('Please select a target branch for this item.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('items').insert([
      {
        name: name.trim(),
        category: category.trim() || 'General',
        unit: unit || 'NOS',
        stock: Number(stock) || 0,
        rate: Number(rate) || 0,
        branch_id: effectiveBranchId
      }
    ]);

    setLoading(false);

    if (error) {
      console.error('Error adding item:', error);
      alert('Error adding item: ' + error.message);
      return;
    }

    setName('');
    setCategory('');
    setStock('');
    setRate('');
    fetchItems();
  }

  async function handleQuickUpdate(id, field, value) {
    const numValue = Number(value);
    if (isNaN(numValue)) return;

    const { error } = await supabase
      .from('items')
      .update({ [field]: numValue })
      .eq('id', id);

    if (error) {
      alert('Update failed: ' + error.message);
    } else {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: numValue } : item))
      );
    }
  }

  async function handleDelete(id, itemName) {
    if (!window.confirm(`Are you sure you want to delete "${itemName}"?`)) return;

    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item: ' + error.message);
      return;
    }
    fetchItems();
  }

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <h1 style={{ margin: 0 }}>
          Items & Stock Inventory{' '}
          {isAllBranches && (
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
              (Consolidated All Branches)
            </span>
          )}
        </h1>

        <input
          type="text"
          placeholder="🔍 Search items or categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '260px', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
        />
      </div>

      {/* Add New Item Section */}
      <form onSubmit={handleAdd} className="form-box">
        <h2 style={{ fontSize: '14.5px', marginBottom: '12px', color: '#1e293b' }}>
          + Add New Inventory Item
        </h2>
        <div className="form-row">
          {isAllBranches && (
            <select
              value={targetBranchId}
              onChange={(e) => setTargetBranchId(e.target.value)}
              required
            >
              <option value="">Select Branch *</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  Add to: {b.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            placeholder="Item / Material Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Category (e.g. Cement, Steel, Pipe)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
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
          <input
            type="number"
            placeholder="Initial Stock Qty"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
          <input
            type="number"
            step="any"
            placeholder="Selling Rate (₹)"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Adding...' : '+ Add Item'}
          </button>
        </div>
      </form>

      {/* Inventory Table */}
      <table>
        <thead>
          <tr>
            {isAllBranches && <th>Branch</th>}
            <th>Item Name</th>
            <th>Category</th>
            <th>Unit</th>
            <th>Stock Available</th>
            <th>Rate / Unit (₹)</th>
            <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((item) => (
            <tr key={item.id}>
              {isAllBranches && (
                <td>
                  <strong>{item.branch?.name || 'Unassigned'}</strong>
                </td>
              )}
              <td><strong>{item.name}</strong></td>
              <td><span className="badge">{item.category || 'General'}</span></td>
              <td>{item.unit}</td>
              <td>
                <input
                  type="number"
                  defaultValue={item.stock}
                  onBlur={(e) => handleQuickUpdate(item.id, 'stock', e.target.value)}
                  style={{
                    width: '90px',
                    height: '30px',
                    padding: '2px 8px',
                    fontWeight: 600,
                    color: item.stock <= 5 ? '#dc2626' : '#047857',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px'
                  }}
                  title="Click to edit stock and click outside to save"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="any"
                  defaultValue={item.rate}
                  onBlur={(e) => handleQuickUpdate(item.id, 'rate', e.target.value)}
                  style={{
                    width: '90px',
                    height: '30px',
                    padding: '2px 8px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px'
                  }}
                  title="Click to edit rate and click outside to save"
                />
              </td>
              <td style={{ textAlign: 'center' }}>
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(item.id, item.name)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {filteredItems.length === 0 && (
            <tr>
              <td
                colSpan={isAllBranches ? 7 : 6}
                style={{ textAlign: 'center', color: '#888', padding: '24px' }}
              >
                No matching items found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Items;
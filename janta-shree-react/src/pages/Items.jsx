import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Items() {
  const { selectedBranch } = useContext(BranchContext);

  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  
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
    fetchItems();
    if (!isAllBranches && selectedBranch) {
      setTargetBranchId(selectedBranch);
    }
  }, [selectedBranch]);

  async function fetchBranches() {
    const { data } = await supabase.from('branches').select('*').order('name');
    if (data) {
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

    // If specific branch selected, show matching branch items OR legacy unassigned items
    if (selectedBranch && selectedBranch !== 'ALL') {
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
    if (!name.trim()) return alert('Please enter item name.');

    const effectiveBranchId = isAllBranches ? targetBranchId : selectedBranch;
    if (!effectiveBranchId || effectiveBranchId === 'ALL') {
      return alert('Please select a target branch for this item.');
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
      alert('Failed to delete item: ' + error.message);
      return;
    }
    fetchItems();
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesLowStock = showLowStockOnly ? Number(item.stock || 0) <= 5 : true;
    return matchesSearch && matchesLowStock;
  });

  const lowStockCount = items.filter((i) => Number(i.stock || 0) <= 5).length;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0 }}>
            Items & Stock Inventory{' '}
            {isAllBranches && (
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                (All Branches View)
              </span>
            )}
          </h1>
          {lowStockCount > 0 && (
            <div style={{ fontSize: '12.5px', color: '#dc2626', fontWeight: 600, marginTop: '4px' }}>
              ⚠️ {lowStockCount} item(s) are in Low Stock (&le; 5 units left)!
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            style={{
              height: '36px',
              padding: '0 12px',
              fontSize: '12.5px',
              backgroundColor: showLowStockOnly ? '#dc2626' : '#f1f5f9',
              color: showLowStockOnly ? '#fff' : '#475569',
              border: '1px solid #cbd5e1'
            }}
          >
            {showLowStockOnly ? 'Show All Items' : `⚠️ Show Low Stock Only (${lowStockCount})`}
          </button>
          <input
            type="text"
            placeholder="🔍 Search item / category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '220px', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
          />
        </div>
      </div>

      {/* Add New Item */}
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

      {/* Table */}
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
          {filteredItems.map((item) => {
            const isLowStock = Number(item.stock || 0) <= 5;
            return (
              <tr key={item.id} style={{ backgroundColor: isLowStock ? '#fff1f2' : 'inherit' }}>
                {isAllBranches && (
                  <td>
                    <strong>{item.branch?.name || 'Unassigned'}</strong>
                  </td>
                )}
                <td>
                  <strong>{item.name}</strong>
                  {isLowStock && (
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#dc2626', fontWeight: 700, backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '3px' }}>
                      LOW STOCK
                    </span>
                  )}
                </td>
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
                      fontWeight: 700,
                      color: isLowStock ? '#dc2626' : '#047857',
                      border: isLowStock ? '1px solid #f87171' : '1px solid #cbd5e1',
                      borderRadius: '4px'
                    }}
                    title="Click to edit stock and blur to save"
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
                    title="Click to edit rate and blur to save"
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
            );
          })}
          {filteredItems.length === 0 && (
            <tr>
              <td
                colSpan={isAllBranches ? 7 : 6}
                style={{ textAlign: 'center', color: '#888', padding: '24px' }}
              >
                No items found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Items;
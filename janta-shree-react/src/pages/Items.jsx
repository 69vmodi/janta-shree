import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Items() {
  const selectedBranch = useContext(BranchContext);

  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('NOS');
  const [stock, setStock] = useState('');
  const [rate, setRate] = useState('');

  const isAllBranches = selectedBranch === 'ALL';

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
    const { data } = await supabase.from('branches').select('*').order('name');
    setBranches(data || []);
    if (data && data.length > 0 && !targetBranchId) {
      setTargetBranchId(data[0].id);
    }
  }

  async function fetchItems() {
    let query = supabase
      .from('items')
      .select('*, branch:branches(name)')
      .order('created_at', { ascending: false });

    if (!isAllBranches) {
      query = query.eq('branch_id', selectedBranch);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching items:', error);
      return;
    }
    setItems(data || []);
  }

  async function handleAdd() {
    if (!name.trim()) {
      alert('Please enter an item name.');
      return;
    }

    const effectiveBranchId = isAllBranches ? targetBranchId : selectedBranch;

    if (!effectiveBranchId) {
      alert('Please select a target branch for this item.');
      return;
    }

    const { error } = await supabase.from('items').insert([
      {
        name,
        category,
        unit,
        stock: Number(stock) || 0,
        rate: Number(rate) || 0,
        branch_id: effectiveBranchId
      }
    ]);

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

  async function handleDelete(id) {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) {
      console.error('Error deleting item:', error);
      return;
    }
    fetchItems();
  }

  return (
    <div className="page">
      <h1>
        Items & Stock{' '}
        {isAllBranches && (
          <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>
            (All Branches View)
          </span>
        )}
      </h1>

      <div className="form-row">
        {isAllBranches && (
          <select
            value={targetBranchId}
            onChange={(e) => setTargetBranchId(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                Add to: {b.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="text"
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <select value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="NOS">NOS</option>
          <option value="KG">KG</option>
          <option value="Liter">Liter</option>
        </select>
        <input
          type="number"
          placeholder="In stock"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
        <input
          type="number"
          placeholder="Rate (₹)"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
        <button onClick={handleAdd}>+ Add Item</button>
      </div>

      <table>
        <thead>
          <tr>
            {isAllBranches && <th>Branch</th>}
            <th>Item</th>
            <th>Category</th>
            <th>Unit</th>
            <th>In Stock</th>
            <th>Rate (₹)</th>
            <th style={{ width: '80px' }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              {isAllBranches && (
                <td>
                  <strong>{item.branch?.name || '-'}</strong>
                </td>
              )}
              <td>{item.name}</td>
              <td>
                <span className="badge">{item.category}</span>
              </td>
              <td>{item.unit}</td>
              <td>{item.stock}</td>
              <td>{item.rate}</td>
              <td>
                <button className="delete-btn" onClick={() => handleDelete(item.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td
                colSpan={isAllBranches ? 7 : 6}
                style={{ textAlign: 'center', color: '#888', padding: '20px' }}
              >
                No items found. Add one above!
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Items;
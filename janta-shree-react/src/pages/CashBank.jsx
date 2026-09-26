import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function CashBank() {
  const selectedBranch = useContext(BranchContext);

  const [entries, setEntries] = useState([]);
  const [branches, setBranches] = useState([]);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [type, setType] = useState('In');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const isAllBranches = selectedBranch === 'ALL';

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchEntries();
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

  async function fetchEntries() {
    let query = supabase
      .from('cash_entries')
      .select('*, branch:branches(name)')
      .order('created_at', { ascending: false });

    if (!isAllBranches) {
      query = query.eq('branch_id', selectedBranch);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching cash entries:', error);
      return;
    }
    setEntries(data || []);
  }

  async function handleAddEntry() {
    const entryAmount = Number(amount);
    if (!entryAmount || entryAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    const effectiveBranchId = isAllBranches ? targetBranchId : selectedBranch;

    if (!effectiveBranchId) {
      alert('Please select a branch for this entry.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('cash_entries').insert([
      {
        type,
        amount: entryAmount,
        description: description.trim() || (type === 'In' ? 'Cash Received' : 'Cash Paid'),
        branch_id: effectiveBranchId
      }
    ]);

    setLoading(false);

    if (error) {
      console.error('Error saving cash entry:', error);
      alert('Error saving cash entry: ' + error.message);
      return;
    }

    setAmount('');
    setDescription('');
    fetchEntries();
  }

  const totalIn = entries
    .filter((e) => e.type === 'In')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalOut = entries
    .filter((e) => e.type === 'Out')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const netBalance = totalIn - totalOut;

  return (
    <div className="page">
      <h1>
        Cash & Bank{' '}
        {isAllBranches && (
          <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>
            (All Branches View)
          </span>
        )}
      </h1>

      <div className="cards">
        <div className="card">
          <p className="card-label">Total Cash In</p>
          <p className="card-value">₹{totalIn}</p>
        </div>
        <div className="card">
          <p className="card-label">Total Cash Out</p>
          <p className="card-value">₹{totalOut}</p>
        </div>
        <div className="card card-blue">
          <p className="card-label">Net Balance</p>
          <p className="card-value">₹{netBalance}</p>
        </div>
      </div>

      <div className="form-row" style={{ marginTop: '20px' }}>
        {isAllBranches && (
          <select
            value={targetBranchId}
            onChange={(e) => setTargetBranchId(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                Branch: {b.name}
              </option>
            ))}
          </select>
        )}

        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="In">Cash In (+)</option>
          <option value="Out">Cash Out (-)</option>
        </select>

        <input
          type="number"
          placeholder="Amount (₹)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          type="text"
          placeholder="Description / Reason"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button onClick={handleAddEntry} disabled={loading}>
          {loading ? 'Adding...' : '+ Add Entry'}
        </button>
      </div>

      <h1 style={{ fontSize: '16px', marginTop: '24px' }}>Transaction History</h1>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            {isAllBranches && <th>Branch</th>}
            <th>Type</th>
            <th>Description</th>
            <th>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{new Date(entry.created_at).toLocaleDateString()}</td>
              {isAllBranches && (
                <td>
                  <strong>{entry.branch?.name || '-'}</strong>
                </td>
              )}
              <td>
                <span
                  className="badge"
                  style={{
                    backgroundColor: entry.type === 'In' ? '#e6f4ea' : '#fce8e6',
                    color: entry.type === 'In' ? '#137333' : '#c5221f'
                  }}
                >
                  {entry.type === 'In' ? 'Cash In' : 'Cash Out'}
                </span>
              </td>
              <td>{entry.description || '-'}</td>
              <td style={{ fontWeight: '500' }}>
                {entry.type === 'In' ? `+₹${entry.amount}` : `-₹${entry.amount}`}
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td
                colSpan={isAllBranches ? 5 : 4}
                style={{ textAlign: 'center', color: '#888', padding: '16px' }}
              >
                No cash entries recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default CashBank;
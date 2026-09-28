import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function CashBank() {
  const { selectedBranch } = useContext(BranchContext);

  const [entries, setEntries] = useState([]);
  const [entryType, setEntryType] = useState('IN'); // 'IN' or 'OUT'
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('Cash');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const isAllBranches = !selectedBranch || selectedBranch === 'ALL';

  useEffect(() => {
    loadCashEntries();
  }, [selectedBranch]);

  async function loadCashEntries() {
    let query = supabase
      .from('cash_entries')
      .select('*, branch:branches(*)')
      .order('created_at', { ascending: false });

    if (!isAllBranches) {
      query = query.or(`branch_id.eq.${selectedBranch},branch_id.is.null`);
    }

    const { data, error } = await query;
    if (!error && data) {
      setEntries(data);
    }
  }

  async function handleAddEntry(e) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return alert('Please enter a valid amount.');
    if (isAllBranches) return alert('Please select a specific branch (Jobat or Alirajpur) from the sidebar.');

    setLoading(true);

    const { error } = await supabase.from('cash_entries').insert([
      {
        type: entryType,
        amount: Number(amount),
        mode: mode,
        description: description.trim() || (entryType === 'IN' ? 'Cash Received' : 'Cash Paid / Expense'),
        branch_id: selectedBranch
      }
    ]);

    setLoading(false);

    if (error) {
      alert('Error recording cash transaction: ' + error.message);
    } else {
      setAmount('');
      setDescription('');
      loadCashEntries();
    }
  }

  const totalIn = entries
    .filter((e) => e.type === 'IN')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const totalOut = entries
    .filter((e) => e.type === 'OUT')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const netBalance = totalIn - totalOut;

  return (
    <div className="page">
      <h1>Cash & Bank Register</h1>

      <div className="cards">
        <div className="card">
          <div className="card-label">Total Cash In (Jama)</div>
          <div className="card-value" style={{ color: '#047857' }}>₹{totalIn.toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="card-label">Total Cash Out (Kharch)</div>
          <div className="card-value" style={{ color: '#dc2626' }}>₹{totalOut.toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="card-label">Net Available Cash</div>
          <div className="card-value" style={{ color: netBalance >= 0 ? '#047857' : '#dc2626' }}>
            ₹{netBalance.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {!isAllBranches && (
        <form onSubmit={handleAddEntry} className="form-box">
          <h2 style={{ fontSize: '15px', marginBottom: '14px', color: '#1e293b' }}>
            + Record Cash / Expense Entry
          </h2>
          <div className="form-row">
            <select value={entryType} onChange={(e) => setEntryType(e.target.value)}>
              <option value="IN">💰 Cash IN (Receipt / Jama)</option>
              <option value="OUT">💸 Cash OUT (Expense / Payment)</option>
            </select>
            <input
              type="number"
              step="any"
              placeholder="Amount (₹) *"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="UPI / Online">UPI / PhonePe / GPay</option>
              <option value="Bank">Bank Account</option>
            </select>
            <input
              type="text"
              placeholder="Description / Remarks (e.g. Chai, Labour, Diesel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Saving...' : '+ Save Entry'}
            </button>
          </div>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Date & Time</th>
            {isAllBranches && <th>Branch</th>}
            <th>Type</th>
            <th>Mode</th>
            <th>Description</th>
            <th style={{ textAlign: 'right' }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.created_at).toLocaleString('en-GB')}</td>
              {isAllBranches && <td><strong>{e.branch?.name || 'All'}</strong></td>}
              <td>
                <span
                  className="badge"
                  style={{
                    backgroundColor: e.type === 'IN' ? '#dcfce7' : '#fee2e2',
                    color: e.type === 'IN' ? '#166534' : '#991b1b'
                  }}
                >
                  {e.type === 'IN' ? 'RECEIPT (IN)' : 'EXPENSE (OUT)'}
                </span>
              </td>
              <td>{e.mode || 'Cash'}</td>
              <td>{e.description || '-'}</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: e.type === 'IN' ? '#047857' : '#dc2626' }}>
                {e.type === 'IN' ? '+' : '-'}₹{Number(e.amount || 0).toLocaleString('en-IN')}
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={isAllBranches ? 6 : 5} style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
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
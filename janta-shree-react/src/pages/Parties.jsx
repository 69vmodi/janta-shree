import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Parties() {
  const { selectedBranch } = useContext(BranchContext);
  const [parties, setParties] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [balance, setBalance] = useState('');
  const [balanceType, setBalanceType] = useState('Dr'); // Dr (Receivable) or Cr (Payable)
  const [partyType, setPartyType] = useState('customer');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedBranch) {
      loadParties();
    }
  }, [selectedBranch]);

  async function loadParties() {
    let query = supabase.from('parties').select('*').order('name');
    if (selectedBranch !== 'ALL') {
      query = query.eq('branch_id', selectedBranch);
    }
    const { data, error } = await query;
    if (!error && data) {
      setParties(data);
    }
  }

  async function handleAddParty(e) {
    e.preventDefault();
    if (!name.trim()) return alert('Please enter Party / Customer Name.');
    if (!selectedBranch || selectedBranch === 'ALL') {
      return alert('Please select a specific branch (Jobat or Alirajpur) from the sidebar first.');
    }

    setLoading(true);
    const numBalance = Number(balance) || 0;

    const { error } = await supabase.from('parties').insert([
      {
        name: name.trim(),
        phone: phone.trim() || null,
        balance: numBalance,
        balance_type: balanceType, // 'Dr' or 'Cr'
        type: partyType,
        branch_id: selectedBranch
      }
    ]);

    setLoading(false);

    if (error) {
      alert('Error saving party: ' + error.message);
    } else {
      setName('');
      setPhone('');
      setBalance('');
      loadParties();
    }
  }

  return (
    <div className="page">
      <h1>Parties & Customer Ledger</h1>

      {selectedBranch !== 'ALL' && (
        <form onSubmit={handleAddParty} className="form-box">
          <h2 style={{ fontSize: '15px', marginBottom: '14px', color: '#1e293b' }}>
            + Add New Party (Manual Balance)
          </h2>
          <div className="form-row">
            <input
              type="text"
              placeholder="Party / Customer Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Phone Number (Optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <select value={partyType} onChange={(e) => setPartyType(e.target.value)}>
              <option value="customer">Customer</option>
              <option value="supplier">Supplier / Vendor</option>
            </select>
          </div>

          <div className="form-row">
            <input
              type="number"
              placeholder="Opening Balance (₹)"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
            <select value={balanceType} onChange={(e) => setBalanceType(e.target.value)}>
              <option value="Dr">Debit (Dr.) - Customer owes you</option>
              <option value="Cr">Credit (Cr.) - You owe them</option>
            </select>
            <button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Party'}
            </button>
          </div>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Party Name</th>
            <th>Type</th>
            <th>Phone</th>
            <th>Balance (₹)</th>
            <th>Account Status</th>
          </tr>
        </thead>
        <tbody>
          {parties.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.name}</strong></td>
              <td><span className="badge">{p.type}</span></td>
              <td>{p.phone || '-'}</td>
              <td>₹{Math.abs(p.balance || 0).toLocaleString('en-IN')}</td>
              <td>
                <span
                  style={{
                    fontWeight: 700,
                    color: p.balance_type === 'Cr' ? '#dc2626' : '#047857'
                  }}
                >
                  {p.balance_type === 'Cr' ? 'Credit (Cr.)' : 'Debit (Dr.)'}
                </span>
              </td>
            </tr>
          ))}
          {parties.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', color: '#888', padding: '16px' }}>
                No parties found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Parties;
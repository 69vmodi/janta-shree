import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Parties() {
  const { selectedBranch } = useContext(BranchContext);

  const [parties, setParties] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [balance, setBalance] = useState('');
  const [balanceType, setBalanceType] = useState('Dr');
  const [loading, setLoading] = useState(false);

  // Modal State
  const [activeParty, setActiveParty] = useState(null);
  const [txnType, setTxnType] = useState('RECEIVE'); // 'RECEIVE' or 'GIVE'
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [notes, setNotes] = useState('');

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
    if (!name.trim()) return alert('Please enter Customer / Party Name.');
    if (!selectedBranch || selectedBranch === 'ALL') {
      return alert('Please select a specific branch from the sidebar first.');
    }

    setLoading(true);
    const balanceNum = Number(balance) || 0;

    const { error } = await supabase.from('parties').insert([
      {
        name: name.trim(),
        phone: phone.trim() || null,
        balance: balanceNum,
        balance_type: balanceType,
        type: 'customer',
        branch_id: selectedBranch
      }
    ]);

    setLoading(false);

    if (error) {
      alert('Error adding party: ' + error.message);
    } else {
      setName('');
      setPhone('');
      setBalance('');
      loadParties();
    }
  }

  async function handleSaveTransaction(e) {
    e.preventDefault();
    if (!activeParty) return;

    const txnAmount = Number(amount);
    if (isNaN(txnAmount) || txnAmount <= 0) {
      return alert('Please enter a valid amount.');
    }

    setLoading(true);

    try {
      // 1. Record transaction in party_payments
      const { error: pErr } = await supabase.from('party_payments').insert([
        {
          party_id: activeParty.id,
          party_name: activeParty.name,
          amount: txnAmount,
          payment_mode: paymentMode,
          notes: notes.trim() || (txnType === 'RECEIVE' ? 'Money Received (Jama)' : 'Money Given (Udhaari)'),
          branch_id: activeParty.branch_id
        }
      ]);

      if (pErr) throw pErr;

      // 2. Calculate updated balance
      let currentBal = Number(activeParty.balance || 0);
      let currentType = activeParty.balance_type || 'Dr';

      // Convert to signed value: Dr is positive (customer owes us), Cr is negative (we owe customer)
      let signedBal = currentType === 'Dr' ? currentBal : -currentBal;

      if (txnType === 'RECEIVE') {
        // Customer pays us -> reduces their debt
        signedBal -= txnAmount;
      } else {
        // We give money/goods -> increases their debt
        signedBal += txnAmount;
      }

      const newType = signedBal >= 0 ? 'Dr' : 'Cr';
      const newBal = Math.abs(signedBal);

      const { error: uErr } = await supabase
        .from('parties')
        .update({ balance: newBal, balance_type: newType })
        .eq('id', activeParty.id);

      if (uErr) throw uErr;

      setActiveParty(null);
      setAmount('');
      setNotes('');
      loadParties();
      alert(`Ledger updated successfully! New Balance: ₹${newBal.toLocaleString('en-IN')} (${newType === 'Dr' ? 'Udhaari / Due' : 'Jama / Advance'})`);
    } catch (err) {
      console.error(err);
      alert('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Parties & Customer Khata</h1>

      {selectedBranch !== 'ALL' && (
        <form onSubmit={handleAddParty} className="form-box">
          <h2 style={{ fontSize: '15px', marginBottom: '14px', color: '#1e293b' }}>
            + Add New Party (Manual Khata Entry)
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
              placeholder="Phone (WhatsApp/Call)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              type="number"
              placeholder="Opening Balance (₹)"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
            <select value={balanceType} onChange={(e) => setBalanceType(e.target.value)}>
              <option value="Dr">Debit (Dr.) - Udhaari / Due (Customer owes you)</option>
              <option value="Cr">Credit (Cr.) - Jama / Advance (Customer gave advance)</option>
            </select>
            <button type="submit" disabled={loading}>
              {loading ? 'Saving...' : '+ Save Party'}
            </button>
          </div>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Party Name</th>
            <th>Phone</th>
            <th>Balance (₹)</th>
            <th>Khata Type</th>
            <th style={{ textAlign: 'center', width: '220px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {parties.map((p) => {
            const bal = Number(p.balance || 0);
            const isDr = (p.balance_type || 'Dr') === 'Dr';
            return (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td>{p.phone || '-'}</td>
                <td style={{ fontWeight: 700, color: isDr && bal > 0 ? '#dc2626' : '#047857' }}>
                  ₹{bal.toLocaleString('en-IN')}
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: isDr && bal > 0 ? '#fee2e2' : '#dcfce7',
                      color: isDr && bal > 0 ? '#991b1b' : '#166534'
                    }}
                  >
                    {isDr ? (bal > 0 ? 'Udhaari / Due (Dr)' : 'Settled / Nil') : 'Advance / Jama (Cr)'}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                    <button
                      onClick={() => {
                        setActiveParty(p);
                        setTxnType('RECEIVE');
                      }}
                      style={{ height: '30px', padding: '0 8px', fontSize: '11px', backgroundColor: '#0284c7' }}
                    >
                      💰 Recv (Jama)
                    </button>
                    <button
                      onClick={() => {
                        setActiveParty(p);
                        setTxnType('GIVE');
                      }}
                      style={{ height: '30px', padding: '0 8px', fontSize: '11px', backgroundColor: '#d97706' }}
                    >
                      💸 Give (Udhaar)
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {parties.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', color: '#888', padding: '16px' }}>
                No parties found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {activeParty && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal" style={{ width: '420px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '6px' }}>
              {txnType === 'RECEIVE' ? '💰 Receive Payment from' : '💸 Give Udhaari / Goods to'} {activeParty.name}
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Current Balance: <strong>₹{Number(activeParty.balance || 0).toLocaleString('en-IN')} ({activeParty.balance_type || 'Dr'})</strong>
            </p>

            <form onSubmit={handleSaveTransaction}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    style={{ width: '100%', height: '38px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    style={{ width: '100%', height: '38px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Bank Transfer">Bank Transfer / Cheque</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Note / Remark
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cleared bill / Cash advance"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ width: '100%', height: '38px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={loading} style={{ flex: 1 }}>
                  {loading ? 'Saving...' : 'Confirm Entry'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveParty(null)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Parties;
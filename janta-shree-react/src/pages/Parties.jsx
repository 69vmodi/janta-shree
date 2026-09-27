import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Parties() {
  const { selectedBranch } = useContext(BranchContext);

  const [parties, setParties] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [loading, setLoading] = useState(false);

  // State for recording payment (when customer gives money)
  const [selectedPartyForPayment, setSelectedPartyForPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');

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

  // 1. Manually add a party with old pending udhaari
  async function handleAddParty(e) {
    e.preventDefault();
    if (!name.trim()) return alert('Please enter Customer / Party Name.');
    if (!selectedBranch || selectedBranch === 'ALL') {
      return alert('Please select a specific branch (Jobat or Alirajpur) from the sidebar first.');
    }

    setLoading(true);
    const balanceNum = Number(initialBalance) || 0;

    const { error } = await supabase.from('parties').insert([
      {
        name: name.trim(),
        phone: phone.trim() || null,
        balance: balanceNum, // Remaining due / udhaari
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
      setInitialBalance('');
      loadParties();
    }
  }

  // 2. Record payment received from customer (reduces their pending balance)
  async function handleReceivePayment(e) {
    e.preventDefault();
    if (!selectedPartyForPayment) return;

    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      return alert('Please enter a valid amount.');
    }

    setLoading(true);

    try {
      // Record payment transaction in ledger
      const { error: paymentErr } = await supabase.from('party_payments').insert([
        {
          party_id: selectedPartyForPayment.id,
          party_name: selectedPartyForPayment.name,
          amount: amount,
          payment_mode: paymentMode,
          notes: paymentNotes.trim() || 'Payment Received',
          branch_id: selectedPartyForPayment.branch_id
        }
      ]);

      if (paymentErr) throw paymentErr;

      // Deduct from party's pending balance
      const newBalance = Math.max(0, Number(selectedPartyForPayment.balance || 0) - amount);

      const { error: updateErr } = await supabase
        .from('parties')
        .update({ balance: newBalance })
        .eq('id', selectedPartyForPayment.id);

      if (updateErr) throw updateErr;

      setSelectedPartyForPayment(null);
      setPaymentAmount('');
      setPaymentNotes('');
      loadParties();
      alert(`₹${amount} payment recorded! New balance for ${selectedPartyForPayment.name}: ₹${newBalance}`);
    } catch (err) {
      console.error(err);
      alert('Failed to record payment: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Parties & Customer Khata</h1>

      {/* Manual Party Creation Form */}
      {selectedBranch !== 'ALL' && (
        <form onSubmit={handleAddParty} className="form-box">
          <h2 style={{ fontSize: '15px', marginBottom: '14px', color: '#1e293b' }}>
            + Add New Party (With Old Pending Udhaari)
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
              placeholder="Phone Number (WhatsApp/Call)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              type="number"
              placeholder="Old Udhaari / Pending Balance (₹)"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Saving...' : '+ Save Party'}
            </button>
          </div>
        </form>
      )}

      {/* Parties List */}
      <table>
        <thead>
          <tr>
            <th>Party Name</th>
            <th>Phone</th>
            <th>Pending Udhaari (Due ₹)</th>
            <th>Status</th>
            <th style={{ textAlign: 'center', width: '160px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {parties.map((p) => {
            const due = Number(p.balance || 0);
            return (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td>{p.phone || '-'}</td>
                <td style={{ fontWeight: 700, color: due > 0 ? '#dc2626' : '#047857' }}>
                  ₹{due.toLocaleString('en-IN')}
                </td>
                <td>
                  <span className="badge" style={{ backgroundColor: due > 0 ? '#fee2e2' : '#dcfce7', color: due > 0 ? '#991b1b' : '#166534' }}>
                    {due > 0 ? 'Pending Udhaari' : 'All Clear / Paid'}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => setSelectedPartyForPayment(p)}
                    style={{ height: '30px', padding: '0 12px', fontSize: '12px', backgroundColor: '#0284c7' }}
                  >
                    💰 Receive Money
                  </button>
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

      {/* Modal for Recording Customer Payment */}
      {selectedPartyForPayment && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal" style={{ width: '420px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>
              Receive Payment from {selectedPartyForPayment.name}
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Current Pending Due: <strong style={{ color: '#dc2626' }}>₹{Number(selectedPartyForPayment.balance || 0).toLocaleString('en-IN')}</strong>
            </p>

            <form onSubmit={handleReceivePayment}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Amount Received (₹) *
                  </label>
                  <input
                    type="number"
                    placeholder="Enter amount customer gave"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    style={{ width: '100%', height: '38px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Payment Mode
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
                    placeholder="e.g. Paid in shop by cash"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    style={{ width: '100%', height: '38px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={loading} style={{ flex: 1 }}>
                  {loading ? 'Updating...' : 'Save Payment Entry'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedPartyForPayment(null)}
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
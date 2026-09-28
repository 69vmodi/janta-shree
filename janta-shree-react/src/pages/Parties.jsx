import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Parties() {
  const { selectedBranch } = useContext(BranchContext);

  const [parties, setParties] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New party form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState('');
  const [balanceType, setBalanceType] = useState('Dr');
  const [loading, setLoading] = useState(false);

  // Transaction Modal
  const [activeParty, setActiveParty] = useState(null);
  const [txnType, setTxnType] = useState('RECEIVE'); // 'RECEIVE' or 'GIVE'
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadParties();
  }, [selectedBranch]);

  async function loadParties() {
    let query = supabase.from('parties').select('*').order('name');
    if (selectedBranch && selectedBranch !== 'ALL') {
      query = query.or(`branch_id.eq.${selectedBranch},branch_id.is.null`);
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
        address: address.trim() || null,
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
      setAddress('');
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
      // 1. Record payment in party_payments
      await supabase.from('party_payments').insert([
        {
          party_id: activeParty.id,
          party_name: activeParty.name,
          amount: txnAmount,
          payment_mode: paymentMode,
          notes: notes.trim() || (txnType === 'RECEIVE' ? 'Money Received (Jama)' : 'Money Given (Udhaari)'),
          branch_id: activeParty.branch_id
        }
      ]);

      // 2. Recalculate balance
      let currentBal = Number(activeParty.balance || 0);
      let currentType = activeParty.balance_type || 'Dr';
      let signedBal = currentType === 'Dr' ? currentBal : -currentBal;

      if (txnType === 'RECEIVE') {
        signedBal -= txnAmount;
      } else {
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
      alert(`Ledger updated! New Balance: ₹${newBal.toLocaleString('en-IN')} (${newType === 'Dr' ? 'Udhaari / Due' : 'Jama / Advance'})`);
    } catch (err) {
      console.error(err);
      alert('Transaction failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteParty(party) {
    const due = Number(party.balance || 0);
    if (due !== 0) {
      return alert(`Cannot delete party "${party.name}". Account has an active balance of ₹${due}. Delete is only allowed when account is clear (₹0).`);
    }

    if (!window.confirm(`Are you sure you want to delete party "${party.name}"? This cannot be undone.`)) {
      return;
    }

    const { error } = await supabase.from('parties').delete().eq('id', party.id);
    if (error) {
      alert('Error deleting party: ' + error.message);
    } else {
      loadParties();
    }
  }

  function sendWhatsAppReminder(party) {
    if (!party.phone) return alert('No phone number saved for this party.');
    const cleanPhone = party.phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const isDr = (party.balance_type || 'Dr') === 'Dr';
    const text = encodeURIComponent(
      `Namaste ${party.name} ji, from Janta Shree.\nYour current account balance is ₹${Number(party.balance || 0).toLocaleString('en-IN')} (${isDr ? 'Due / Udhaari' : 'Advance'}). Kindly review.`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  }

  function sendSMS(party) {
    if (!party.phone) return alert('No phone number saved for this party.');
    const isDr = (party.balance_type || 'Dr') === 'Dr';
    const text = encodeURIComponent(
      `Namaste ${party.name} ji, from Janta Shree. Balance: Rs.${party.balance || 0} (${isDr ? 'Due' : 'Advance'}).`
    );
    window.open(`sms:${party.phone}?body=${text}`, '_blank');
  }

  const filteredParties = parties.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.phone && p.phone.includes(searchQuery)) ||
    (p.address && p.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <h1 style={{ margin: 0 }}>Parties & Customer Khata</h1>
        <input
          type="text"
          placeholder="🔍 Search party by name, phone, address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '280px', height: '36px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
        />
      </div>

      {/* Manual Party Creation Form with Address */}
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
              type="text"
              placeholder="Address / City (e.g. Jobat / Alirajpur)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="form-row">
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

      {/* Parties Table */}
      <table>
        <thead>
          <tr>
            <th>Party Name</th>
            <th>Phone</th>
            <th>Address</th>
            <th>Balance (₹)</th>
            <th>Khata Type</th>
            <th style={{ textAlign: 'center' }}>Contact</th>
            <th style={{ textAlign: 'center' }}>Khata Action</th>
            <th style={{ textAlign: 'center' }}>Remove</th>
          </tr>
        </thead>
        <tbody>
          {filteredParties.map((p) => {
            const bal = Number(p.balance || 0);
            const isDr = (p.balance_type || 'Dr') === 'Dr';
            const isAccountClear = bal === 0;

            return (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td>{p.phone || '-'}</td>
                <td style={{ color: '#64748b', fontSize: '12.5px' }}>{p.address || '-'}</td>
                <td style={{ fontWeight: 700, color: isDr && bal > 0 ? '#dc2626' : '#047857' }}>
                  ₹{bal.toLocaleString('en-IN')}
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: isAccountClear ? '#f1f5f9' : (isDr ? '#fee2e2' : '#dcfce7'),
                      color: isAccountClear ? '#475569' : (isDr ? '#991b1b' : '#166534')
                    }}
                  >
                    {isAccountClear ? 'Account Clear (₹0)' : (isDr ? 'Udhaari / Due (Dr)' : 'Advance / Jama (Cr)')}
                  </span>
                </td>
                {/* WhatsApp & SMS Buttons */}
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {p.phone ? (
                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => sendWhatsAppReminder(p)}
                        title="Send WhatsApp Reminder"
                        style={{ height: '28px', padding: '0 8px', fontSize: '11px', backgroundColor: '#25D366' }}
                      >
                        💬 WA
                      </button>
                      <button
                        type="button"
                        onClick={() => sendSMS(p)}
                        title="Send SMS"
                        style={{ height: '28px', padding: '0 8px', fontSize: '11px', backgroundColor: '#475569' }}
                      >
                        ✉️ SMS
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>No Phone</span>
                  )}
                </td>
                {/* Khata Actions */}
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'inline-flex', gap: '4px' }}>
                    <button
                      onClick={() => { setActiveParty(p); setTxnType('RECEIVE'); }}
                      style={{ height: '28px', padding: '0 8px', fontSize: '11px', backgroundColor: '#0284c7' }}
                    >
                      💰 Jama
                    </button>
                    <button
                      onClick={() => { setActiveParty(p); setTxnType('GIVE'); }}
                      style={{ height: '28px', padding: '0 8px', fontSize: '11px', backgroundColor: '#d97706' }}
                    >
                      💸 Udhaar
                    </button>
                  </div>
                </td>
                {/* Delete Party (Only available if account is clear) */}
                <td style={{ textAlign: 'center' }}>
                  {isAccountClear ? (
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteParty(p)}
                      title="Account is clear, you can safely delete this party"
                    >
                      🗑️ Delete
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }} title="Clear balance to ₹0 first">
                      Active
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {filteredParties.length === 0 && (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
                No parties match your search.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Transaction Modal */}
      {activeParty && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal" style={{ width: '420px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '6px' }}>
              {txnType === 'RECEIVE' ? '💰 Receive Payment (Jama)' : '💸 Give Udhaari / Goods'} : {activeParty.name}
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
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Mode</label>
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
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Remark</label>
                  <input
                    type="text"
                    placeholder="e.g. Paid in cash at counter"
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
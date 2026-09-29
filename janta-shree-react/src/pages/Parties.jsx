import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Parties() {
  const { selectedBranch } = useContext(BranchContext);

  const currentBranchId =
    typeof selectedBranch === 'object' && selectedBranch !== null
      ? selectedBranch.selectedBranch
      : selectedBranch;

  const isAllBranches = !currentBranchId || currentBranchId === 'ALL';

  const [parties, setParties] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [balanceType, setBalanceType] = useState('Dr');
  const [loading, setLoading] = useState(false);

  // Selected Party Ledger State
  const [activeLedgerParty, setActiveLedgerParty] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Quick Payment Receive Form inside Ledger
  const [receivedAmount, setReceivedAmount] = useState('');
  const [receivedMode, setReceivedMode] = useState('Cash');
  const [receivedNote, setReceivedNote] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    loadParties();
  }, [currentBranchId]);

  async function loadParties() {
    let query = supabase.from('parties').select('*').order('name');
    if (!isAllBranches) {
      query = query.or(`branch_id.eq.${currentBranchId},branch_id.is.null`);
    }
    const { data, error } = await query;
    if (!error && data) {
      setParties(data);
    }
  }

  async function handleAddParty(e) {
    e.preventDefault();
    if (!name.trim()) return alert('Party ka naam likhiye.');
    if (isAllBranches) return alert('Sidebar se pehle Jobat ya Alirajpur branch select karein.');

    setLoading(true);
    const balNum = Number(openingBalance) || 0;

    const { error } = await supabase.from('parties').insert([
      {
        name: name.trim(),
        phone: phone.trim() || null,
        type: 'customer',
        balance: balNum,
        balance_type: balanceType,
        branch_id: currentBranchId
      }
    ]);

    setLoading(false);
    if (error) {
      alert('Error adding party: ' + error.message);
    } else {
      setName('');
      setPhone('');
      setOpeningBalance('');
      loadParties();
    }
  }

  // Open Ledger and fetch Bills + Payments Date-wise
  async function handleOpenLedger(party) {
    setActiveLedgerParty(party);
    setLedgerLoading(true);

    try {
      // 1. Fetch Invoices/Bills billed to this customer
      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .ilike('customer', party.name.trim())
        .order('created_at', { ascending: true });

      // 2. Fetch Payments received from this customer
      const { data: paymentsData } = await supabase
        .from('party_payments')
        .select('*')
        .or(`party_id.eq.${party.id},party_name.ilike.${party.name.trim()}`)
        .order('created_at', { ascending: true });

      // Format bills as Debit entries (Maal diya)
      const formattedBills = (salesData || []).map((s) => ({
        id: 'bill-' + s.id,
        date: s.created_at,
        type: 'BILL',
        ref: s.invoice_no || `JS-${s.id.slice(0, 5)}`,
        description: `Bill Generated (${s.payment_type || 'Sale'})`,
        debit: Number(s.total || 0),
        credit: 0,
        paymentMode: s.payment_type
      }));

      // Format payments as Credit entries (Paisa mila / Jama)
      const formattedPayments = (paymentsData || []).map((p) => ({
        id: 'pay-' + p.id,
        date: p.created_at,
        type: 'PAYMENT',
        ref: 'PAY-' + p.id.slice(0, 5),
        description: p.notes || 'Payment Received (Jama)',
        debit: 0,
        credit: Number(p.amount || 0),
        paymentMode: p.payment_mode || 'Cash'
      }));

      // Merge and sort chronologically by date
      const combined = [...formattedBills, ...formattedPayments].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      setLedgerEntries(combined);
    } catch (err) {
      console.error(err);
      alert('Ledger load karne me error: ' + err.message);
    } finally {
      setLedgerLoading(false);
    }
  }

  // Save new payment received directly in Party Khata
  async function handleRecordPayment(e) {
    e.preventDefault();
    if (!receivedAmount || Number(receivedAmount) <= 0) {
      return alert('Sahi amount daliye.');
    }

    setSavingPayment(true);
    const amt = Number(receivedAmount);

    try {
      // 1. Insert into party_payments table
      await supabase.from('party_payments').insert([
        {
          party_id: activeLedgerParty.id,
          party_name: activeLedgerParty.name,
          amount: amt,
          payment_mode: receivedMode,
          notes: receivedNote.trim() || 'Payment Received (Jama)',
          branch_id: activeLedgerParty.branch_id || currentBranchId
        }
      ]);

      // 2. Insert into cash_entries register so Cash & Bank is also synchronized
      if (currentBranchId && currentBranchId !== 'ALL') {
        await supabase.from('cash_entries').insert([
          {
            type: 'IN',
            amount: amt,
            mode: receivedMode,
            description: `Payment received from party: ${activeLedgerParty.name}`,
            branch_id: activeLedgerParty.branch_id || currentBranchId
          }
        ]);
      }

      // 3. Update Party Balance
      let curBal = Number(activeLedgerParty.balance || 0);
      let curType = activeLedgerParty.balance_type || 'Dr';
      let signedBal = curType === 'Dr' ? curBal : -curBal;

      signedBal -= amt; // Customer paid -> due reduces

      const updatedType = signedBal >= 0 ? 'Dr' : 'Cr';
      const updatedBal = Math.abs(signedBal);

      await supabase
        .from('parties')
        .update({
          balance: updatedBal,
          balance_type: updatedType
        })
        .eq('id', activeLedgerParty.id);

      alert(`₹${amt} Jama ho gaya hai!`);
      setReceivedAmount('');
      setReceivedNote('');

      // Refresh Ledger & Parties List
      const updatedPartyObj = {
        ...activeLedgerParty,
        balance: updatedBal,
        balance_type: updatedType
      };
      setActiveLedgerParty(updatedPartyObj);
      handleOpenLedger(updatedPartyObj);
      loadParties();
    } catch (err) {
      console.error(err);
      alert('Payment save karne me error: ' + err.message);
    } finally {
      setSavingPayment(false);
    }
  }

  const filteredParties = parties.filter((p) =>
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.phone && p.phone.includes(searchTerm))
  );

  return (
    <div className="page">
      <h1>Parties & Customer Ledger</h1>

      {/* Add New Party */}
      {!isAllBranches && (
        <form onSubmit={handleAddParty} className="form-box">
          <h2 style={{ fontSize: '15px', marginBottom: '14px', color: '#1e293b' }}>
            + Nayi Party / Grahak Add Karein
          </h2>
          <div className="form-row">
            <input
              type="text"
              placeholder="Party Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Mobile Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              type="number"
              step="any"
              placeholder="Opening Balance (₹)"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
            <select value={balanceType} onChange={(e) => setBalanceType(e.target.value)}>
              <option value="Dr">Dr (Baaki / Lena Hai)</option>
              <option value="Cr">Cr (Advance / Dena Hai)</option>
            </select>
            <button type="submit" disabled={loading}>
              {loading ? 'Adding...' : '+ Save Party'}
            </button>
          </div>
        </form>
      )}

      {/* Search Bar */}
      <div style={{ margin: '14px 0' }}>
        <input
          type="text"
          placeholder="🔍 Party ke naam ya mobile number se search karein..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', maxWidth: '380px', padding: '9px 12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
        />
      </div>

      {/* Parties Table */}
      <table>
        <thead>
          <tr>
            <th>Party Name</th>
            <th>Phone</th>
            <th>Balance Type</th>
            <th>Current Balance</th>
            <th style={{ textAlign: 'center' }}>Khata / Statement</th>
          </tr>
        </thead>
        <tbody>
          {filteredParties.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.name}</strong></td>
              <td>{p.phone || '-'}</td>
              <td>
                <span
                  className="badge"
                  style={{
                    backgroundColor: (p.balance_type || 'Dr') === 'Dr' ? '#fee2e2' : '#dcfce7',
                    color: (p.balance_type || 'Dr') === 'Dr' ? '#991b1b' : '#166534'
                  }}
                >
                  {p.balance_type === 'Cr' ? 'Advance (Cr)' : 'Pending Due (Dr)'}
                </span>
              </td>
              <td style={{ fontWeight: 700, color: (p.balance_type || 'Dr') === 'Dr' ? '#dc2626' : '#047857' }}>
                ₹{Number(p.balance || 0).toLocaleString('en-IN')}
              </td>
              <td style={{ textAlign: 'center' }}>
                <button
                  style={{ height: '30px', padding: '0 12px', fontSize: '12px' }}
                  onClick={() => handleOpenLedger(p)}
                >
                  📖 View Statement
                </button>
              </td>
            </tr>
          ))}
          {filteredParties.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
                Koi party nahi mili.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* PARTY LEDGER / KHATA MODAL */}
      {activeLedgerParty && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal" style={{ width: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #cbd5e1', paddingBottom: '12px', marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '18px', color: '#0f172a', margin: 0 }}>
                  📖 Khata Statement: {activeLedgerParty.name}
                </h2>
                {activeLedgerParty.phone && (
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Mob: {activeLedgerParty.phone}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Current Balance</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: activeLedgerParty.balance_type === 'Dr' ? '#dc2626' : '#047857' }}>
                  ₹{Number(activeLedgerParty.balance || 0).toLocaleString('en-IN')}{' '}
                  <span style={{ fontSize: '12px' }}>({activeLedgerParty.balance_type === 'Dr' ? 'Lena Hai' : 'Advance'})</span>
                </div>
              </div>
            </div>

            {/* Quick Payment Entry Form */}
            <form onSubmit={handleRecordPayment} style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                + Party Se Payment Mila (Jama Entry)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  step="any"
                  placeholder="Amount (₹) *"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  style={{ width: '130px', height: '34px', padding: '4px 8px', fontSize: '13px' }}
                  required
                />
                <select
                  value={receivedMode}
                  onChange={(e) => setReceivedMode(e.target.value)}
                  style={{ width: '130px', height: '34px', padding: '4px 8px', fontSize: '13px' }}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI / PhonePe">UPI / Online</option>
                  <option value="Bank">Bank Account</option>
                </select>
                <input
                  type="text"
                  placeholder="Remarks (e.g. Cheque No / PhonePe)"
                  value={receivedNote}
                  onChange={(e) => setReceivedNote(e.target.value)}
                  style={{ flex: 1, minWidth: '150px', height: '34px', padding: '4px 8px', fontSize: '13px' }}
                />
                <button
                  type="submit"
                  disabled={savingPayment}
                  style={{ height: '34px', padding: '0 14px', fontSize: '12.5px' }}
                >
                  {savingPayment ? 'Saving...' : '✓ Jama Karein'}
                </button>
              </div>
            </form>

            {/* Date-wise Statement Table */}
            {ledgerLoading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                Statement load ho raha hai...
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ref / Bill No</th>
                    <th>Description</th>
                    <th>Mode</th>
                    <th style={{ textAlign: 'right', color: '#dc2626' }}>Bill Diya (Dr)</th>
                    <th style={{ textAlign: 'right', color: '#047857' }}>Payment Mila (Cr)</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map((row) => (
                    <tr key={row.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(row.date).toLocaleDateString('en-GB')}
                      </td>
                      <td>
                        <strong>{row.ref}</strong>
                      </td>
                      <td>{row.description}</td>
                      <td>
                        <span className="badge">{row.paymentMode || '-'}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: row.debit > 0 ? '#dc2626' : '#94a3b8' }}>
                        {row.debit > 0 ? `₹${row.debit.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: row.credit > 0 ? '#047857' : '#94a3b8' }}>
                        {row.credit > 0 ? `₹${row.credit.toLocaleString('en-IN')}` : '-'}
                      </td>
                    </tr>
                  ))}
                  {ledgerEntries.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#888', padding: '24px' }}>
                        Is party ka abhi tak koi bill ya payment record nahi hai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                className="btn-secondary"
                onClick={() => setActiveLedgerParty(null)}
                style={{ padding: '0 20px' }}
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Parties;
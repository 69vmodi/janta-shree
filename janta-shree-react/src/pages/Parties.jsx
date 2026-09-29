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
    if (!name.trim()) return alert('कृपया पार्टी का नाम दर्ज करें।');
    if (isAllBranches) return alert('कृपया साइडबार से ब्रांच (Jobat या Alirajpur) चुनें।');

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
      alert('Error: ' + error.message);
    } else {
      setName('');
      setPhone('');
      setOpeningBalance('');
      loadParties();
    }
  }

  // Delete Party permanently
  async function handleDeleteParty(party) {
    const isSure = window.confirm(
      `क्या आप सचमुच "${party.name}" को हटाना चाहते हैं? यह पार्टी हमेशा के लिए डिलीट हो जाएगी।`
    );
    if (!isSure) return;

    try {
      const { error } = await supabase
        .from('parties')
        .delete()
        .eq('id', party.id);

      if (error) throw error;

      alert(`पार्टी "${party.name}" सफलतापूर्वक डिलीट कर दी गई है।`);
      loadParties();
    } catch (err) {
      console.error(err);
      alert('Delete failed: ' + err.message);
    }
  }

  // Open Ledger and fetch Bills + Payments Date-wise
  async function handleOpenLedger(party) {
    setActiveLedgerParty(party);
    setLedgerLoading(true);

    try {
      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .ilike('customer', party.name.trim())
        .order('created_at', { ascending: true });

      const { data: paymentsData } = await supabase
        .from('party_payments')
        .select('*')
        .or(`party_id.eq.${party.id},party_name.ilike.${party.name.trim()}`)
        .order('created_at', { ascending: true });

      const formattedBills = (salesData || []).map((s) => ({
        id: 'bill-' + s.id,
        date: s.created_at,
        type: 'BILL',
        ref: s.invoice_no || `JS-${s.id.slice(0, 5)}`,
        description: `बिल बना (${s.payment_type || 'Sale'})`,
        debit: Number(s.total || 0),
        credit: 0,
        paymentMode: s.payment_type
      }));

      const formattedPayments = (paymentsData || []).map((p) => ({
        id: 'pay-' + p.id,
        date: p.created_at,
        type: 'PAYMENT',
        ref: 'PAY-' + p.id.slice(0, 5),
        description: p.notes || 'भुगतान प्राप्त (जमा)',
        debit: 0,
        credit: Number(p.amount || 0),
        paymentMode: p.payment_mode || 'Cash'
      }));

      const combined = [...formattedBills, ...formattedPayments].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      setLedgerEntries(combined);
    } catch (err) {
      console.error(err);
      alert('Error loading ledger: ' + err.message);
    } finally {
      setLedgerLoading(false);
    }
  }

  // Save new payment received directly in Party Ledger
  async function handleRecordPayment(e) {
    e.preventDefault();
    if (!receivedAmount || Number(receivedAmount) <= 0) {
      return alert('कृपया सही राशि दर्ज करें।');
    }

    setSavingPayment(true);
    const amt = Number(receivedAmount);

    try {
      await supabase.from('party_payments').insert([
        {
          party_id: activeLedgerParty.id,
          party_name: activeLedgerParty.name,
          amount: amt,
          payment_mode: receivedMode,
          notes: receivedNote.trim() || 'भुगतान प्राप्त (जमा)',
          branch_id: activeLedgerParty.branch_id || currentBranchId
        }
      ]);

      if (currentBranchId && currentBranchId !== 'ALL') {
        await supabase.from('cash_entries').insert([
          {
            type: 'IN',
            amount: amt,
            mode: receivedMode,
            description: `पार्टी से पेमेंट आया: ${activeLedgerParty.name}`,
            branch_id: activeLedgerParty.branch_id || currentBranchId
          }
        ]);
      }

      let curBal = Number(activeLedgerParty.balance || 0);
      let curType = (activeLedgerParty.balance_type || 'Dr').toUpperCase();
      let signedBal = curType === 'DR' ? curBal : -curBal;

      signedBal -= amt;

      const updatedType = signedBal >= 0 ? 'Dr' : 'Cr';
      const updatedBal = Math.abs(signedBal);

      await supabase
        .from('parties')
        .update({
          balance: updatedBal,
          balance_type: updatedType
        })
        .eq('id', activeLedgerParty.id);

      alert(`₹${amt} जमा कर लिया गया है!`);
      setReceivedAmount('');
      setReceivedNote('');

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
      alert('Error: ' + err.message);
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleUpdatePhone(party) {
    const inputPhone = prompt(`पार्टी "${party.name}" का 10 अंकों का मोबाइल नंबर दर्ज करें:`, party.phone || '');
    if (inputPhone === null) return null;
    const cleanPhone = inputPhone.trim();

    if (cleanPhone) {
      await supabase
        .from('parties')
        .update({ phone: cleanPhone })
        .eq('id', party.id);
      loadParties();
    }
    return cleanPhone;
  }

  // Pure Hindi WhatsApp Reminder
  async function sendWhatsAppReminder(party) {
    let targetPhone = party.phone;

    if (!targetPhone) {
      targetPhone = await handleUpdatePhone(party);
      if (!targetPhone) return;
    }

    const cleanPhone = targetPhone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const message = encodeURIComponent(
      `नमस्ते ${party.name} जी,\n\nजनता श्री (Janta Shree) से आपका बकाया भुगतान (उधारी) ₹${Number(party.balance || 0).toLocaleString('en-IN')} बाकी है।\n\nकृपया जल्द से जल्द भुगतान करने का कष्ट करें।\n\nधन्यवाद!`
    );

    window.open(`https://wa.me/${phoneWithCode}?text=${message}`, '_blank');
  }

  // Pure Hindi SMS Reminder
  async function sendSMSReminder(party) {
    let targetPhone = party.phone;

    if (!targetPhone) {
      targetPhone = await handleUpdatePhone(party);
      if (!targetPhone) return;
    }

    const cleanPhone = targetPhone.replace(/[^0-9]/g, '');

    const message = encodeURIComponent(
      `नमस्ते ${party.name} जी, जनता श्री (Janta Shree) में आपका बकाया ₹${Number(party.balance || 0).toLocaleString('en-IN')} बाकी है। कृपया जल्द भुगतान करें। धन्यवाद।`
    );

    window.open(`sms:${cleanPhone}?body=${message}`, '_self');
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
            + Add New Party / Customer
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
              <option value="Dr">Dr (Receivable / Pending Due)</option>
              <option value="Cr">Cr (Payable / Advance Deposit)</option>
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
          placeholder="🔍 Search by party name or phone number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', maxWidth: '380px', padding: '9px 12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
        />
      </div>

      {/* Parties Table with WhatsApp, SMS, Statement, and Delete Actions */}
      <table>
        <thead>
          <tr>
            <th>Party Name</th>
            <th>Phone</th>
            <th>Balance Type</th>
            <th>Current Balance</th>
            <th style={{ textAlign: 'center' }}>Send Reminder</th>
            <th style={{ textAlign: 'center' }}>Ledger / Statement</th>
            <th style={{ textAlign: 'center' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredParties.map((p) => {
            const balVal = Number(p.balance || 0);
            const bType = (p.balance_type || 'Dr').toUpperCase();
            const isAdvance = bType === 'CR';

            return (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td>
                  {p.phone ? (
                    <span>{p.phone}</span>
                  ) : (
                    <button
                      onClick={() => handleUpdatePhone(p)}
                      style={{
                        height: '24px',
                        padding: '0 8px',
                        fontSize: '11px',
                        backgroundColor: '#f1f5f9',
                        color: '#0284c7',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      + Add Phone
                    </button>
                  )}
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: isAdvance ? '#dcfce7' : '#fee2e2',
                      color: isAdvance ? '#166534' : '#991b1b'
                    }}
                  >
                    {isAdvance ? 'Advance (Cr)' : 'Pending Due (Dr)'}
                  </span>
                </td>
                <td style={{ fontWeight: 700, color: isAdvance ? '#047857' : '#dc2626' }}>
                  ₹{balVal.toLocaleString('en-IN')}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                    <button
                      onClick={() => sendWhatsAppReminder(p)}
                      title="Send Hindi WhatsApp Reminder"
                      style={{
                        height: '30px',
                        padding: '0 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: '#25D366',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      💬 WhatsApp
                    </button>
                    <button
                      onClick={() => sendSMSReminder(p)}
                      title="Send Hindi SMS"
                      style={{
                        height: '30px',
                        padding: '0 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      📱 SMS
                    </button>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    style={{ height: '30px', padding: '0 12px', fontSize: '12px' }}
                    onClick={() => handleOpenLedger(p)}
                  >
                    📖 View Statement
                  </button>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => handleDeleteParty(p)}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #f87171',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    title="Delete Party"
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            );
          })}
          {filteredParties.length === 0 && (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
                No parties found.
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
                  📖 Statement of Account: {activeLedgerParty.name}
                </h2>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Phone: {activeLedgerParty.phone || 'Not added'}{' '}
                  <button
                    onClick={async () => {
                      const newP = await handleUpdatePhone(activeLedgerParty);
                      if (newP) setActiveLedgerParty({ ...activeLedgerParty, phone: newP });
                    }}
                    style={{ background: 'none', border: 'none', color: '#0284c7', textDecoration: 'underline', padding: 0, height: 'auto', fontSize: '11px', cursor: 'pointer' }}
                  >
                    (Edit)
                  </button>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Current Balance</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: (activeLedgerParty.balance_type || '').toUpperCase() === 'CR' ? '#047857' : '#dc2626' }}>
                  ₹{Number(activeLedgerParty.balance || 0).toLocaleString('en-IN')}{' '}
                  <span style={{ fontSize: '12px' }}>({(activeLedgerParty.balance_type || '').toUpperCase() === 'CR' ? 'Advance' : 'Receivable'})</span>
                </div>
              </div>
            </div>

            {/* Quick Actions (Hindi WhatsApp / SMS Inside Modal) */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <button
                onClick={() => sendWhatsAppReminder(activeLedgerParty)}
                style={{ height: '32px', padding: '0 12px', fontSize: '12px', backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                💬 Send Reminder via WhatsApp
              </button>
              <button
                onClick={() => sendSMSReminder(activeLedgerParty)}
                style={{ height: '32px', padding: '0 12px', fontSize: '12px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                📱 Send Reminder via SMS
              </button>
            </div>

            {/* Quick Payment Entry Form */}
            <form onSubmit={handleRecordPayment} style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                + Record Payment Received from Party
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
                  {savingPayment ? 'Saving...' : '✓ Save Payment'}
                </button>
              </div>
            </form>

            {/* Date-wise Statement Table */}
            {ledgerLoading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                Loading statement...
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ref / Bill No</th>
                    <th>Description</th>
                    <th>Mode</th>
                    <th style={{ textAlign: 'right', color: '#dc2626' }}>Bill Given (Dr)</th>
                    <th style={{ textAlign: 'right', color: '#047857' }}>Payment Received (Cr)</th>
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
                        No bills or payment records found for this party yet.
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
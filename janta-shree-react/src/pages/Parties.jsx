import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Parties() {
  const selectedBranch = useContext(BranchContext);
  const [parties, setParties] = useState([]);

  // Settlement Modal State
  const [activeParty, setActiveParty] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [loading, setLoading] = useState(false);

  // Phone Edit Inline State
  const [editingPartyId, setEditingPartyId] = useState(null);
  const [phoneInput, setPhoneInput] = useState('');

  const isAllBranches = selectedBranch === 'ALL';

  useEffect(() => {
    if (selectedBranch) {
      fetchParties();
    }
  }, [selectedBranch]);

  async function fetchParties() {
    let query = supabase
      .from('parties')
      .select('*, branch:branches(name)')
      .order('name');

    if (!isAllBranches) {
      query = query.eq('branch_id', selectedBranch);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching parties:', error);
      return;
    }
    setParties(data || []);
  }

  function openSettlementModal(party) {
    setActiveParty(party);
    setSettleAmount('');
    setSettleNote('');
  }

  function closeSettlementModal() {
    setActiveParty(null);
    setSettleAmount('');
    setSettleNote('');
  }

  async function handleSettlePayment() {
    const amount = Number(settleAmount);
    if (!amount || amount <= 0) {
      alert('कृपया मान्य राशि दर्ज करें।');
      return;
    }

    if (amount > Number(activeParty.balance)) {
      if (!window.confirm(`राशि (₹${amount}) कुल बकाया (₹${activeParty.balance}) से अधिक है। क्या आप आगे बढ़ना चाहते हैं?`)) {
        return;
      }
    }

    setLoading(true);

    try {
      const newBalance = Math.max(0, Number(activeParty.balance) - amount);

      const { error: partyError } = await supabase
        .from('parties')
        .update({ balance: newBalance })
        .eq('id', activeParty.id);

      if (partyError) throw partyError;

      const isCustomer = activeParty.type === 'customer';
      const cashType = isCustomer ? 'In' : 'Out';
      const autoDesc = isCustomer
        ? `${activeParty.name} से भुगतान प्राप्त हुआ${settleNote ? ` (${settleNote})` : ''}`
        : `${activeParty.name} को भुगतान किया${settleNote ? ` (${settleNote})` : ''}`;

      const { error: cashError } = await supabase
        .from('cash_entries')
        .insert([
          {
            type: cashType,
            amount: amount,
            description: autoDesc,
            branch_id: activeParty.branch_id
          }
        ]);

      if (cashError) throw cashError;

      alert(`₹${amount} का भुगतान सफलतापूर्वक दर्ज किया गया!`);
      closeSettlementModal();
      fetchParties();
    } catch (err) {
      console.error(err);
      alert('त्रुटि: ' + (err.message || 'अज्ञात त्रुटि'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePhone(partyId) {
    const cleanPhone = phoneInput.trim().replace(/\D/g, '');
    const { error } = await supabase
      .from('parties')
      .update({ phone: cleanPhone })
      .eq('id', partyId);

    if (error) {
      alert('मोबाइल नंबर अपडेट नहीं हो सका: ' + error.message);
      return;
    }

    setEditingPartyId(null);
    fetchParties();
  }

  function getReminderMessage(party) {
    const branchName = party.branch?.name || 'Sanjay Shah';
    const amount = Number(party.balance).toLocaleString('en-IN');

    return `नमस्ते ${party.name} जी,\n\nयह *${branchName} (Janta Shree)* की तरफ से पेमेंट रिमाइंडर है।\n\nआपका कुल बकाया राशि (Pending Balance): *₹${amount}* है।\n\nकृपया बकाया राशि का भुगतान जल्द से जल्द करने की कृपा करें।\n\nधन्यवाद!\n*${branchName}*`;
  }

  function handleSendWhatsApp(party) {
    let cleanPhone = (party.phone || '').trim().replace(/\D/g, '');

    if (!cleanPhone || cleanPhone.length < 10) {
      const input = prompt(`कृपया ${party.name} का 10 अंकों का मोबाइल नंबर दर्ज करें:`, cleanPhone);
      if (!input) return;
      cleanPhone = input.trim().replace(/\D/g, '');
      supabase.from('parties').update({ phone: cleanPhone }).eq('id', party.id).then();
    }

    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    const message = getReminderMessage(party);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  function handleSendSMS(party) {
    let cleanPhone = (party.phone || '').trim().replace(/\D/g, '');

    if (!cleanPhone || cleanPhone.length < 10) {
      const input = prompt(`कृपया ${party.name} का 10 अंकों का मोबाइल नंबर दर्ज करें:`, cleanPhone);
      if (!input) return;
      cleanPhone = input.trim().replace(/\D/g, '');
      supabase.from('parties').update({ phone: cleanPhone }).eq('id', party.id).then();
    }

    const branchName = party.branch?.name || 'Sanjay Shah';
    const amount = Number(party.balance).toLocaleString('en-IN');
    const message = `नमस्ते ${party.name} जी, यह ${branchName} (Janta Shree) की तरफ से पेमेंट रिमाइंडर है। आपका कुल बकाया राशि ₹${amount} है। कृपया जल्द से जल्द भुगतान करें। धन्यवाद!`;
    const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, '_blank');
  }

  const customers = parties.filter((p) => p.type === 'customer');
  const suppliers = parties.filter((p) => p.type === 'supplier');

  const totalReceivable = customers.reduce((sum, p) => sum + Number(p.balance), 0);
  const totalPayable = suppliers.reduce((sum, p) => sum + Number(p.balance), 0);

  return (
    <div className="page">
      <h1>
        Parties & Ledgers{' '}
        {isAllBranches && (
          <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>
            (All Branches View)
          </span>
        )}
      </h1>

      <div className="cards">
        <div className="card card-blue">
          <p className="card-label">To collect (customers)</p>
          <p className="card-value">₹{totalReceivable.toLocaleString('en-IN')}</p>
        </div>
        <div className="card">
          <p className="card-label">To pay (suppliers)</p>
          <p className="card-value">₹{totalPayable.toLocaleString('en-IN')}</p>
        </div>
      </div>

      <h1 style={{ fontSize: '16px', marginTop: '20px' }}>Customers (Pending Receivables)</h1>
      <table>
        <thead>
          <tr>
            {isAllBranches && <th>Branch</th>}
            <th>Customer Name</th>
            <th style={{ width: '190px' }}>Mobile Number</th>
            <th>Balance Due (₹)</th>
            <th style={{ width: '280px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((p) => (
            <tr key={p.id}>
              {isAllBranches && <td><strong>{p.branch?.name || '-'}</strong></td>}
              <td><strong>{p.name}</strong></td>
              <td>
                {editingPartyId === p.id ? (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="10-digit number"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      style={{ width: '110px', height: '28px', padding: '2px 6px', fontSize: '12px' }}
                      autoFocus
                    />
                    <button
                      onClick={() => handleSavePhone(p.id)}
                      style={{ height: '28px', padding: '0 8px', fontSize: '11px' }}
                    >
                      Save
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => setEditingPartyId(null)}
                      style={{ height: '28px', padding: '0 6px', fontSize: '11px' }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <span
                    onClick={() => {
                      setEditingPartyId(p.id);
                      setPhoneInput(p.phone || '');
                    }}
                    style={{
                      cursor: 'pointer',
                      borderBottom: '1px dashed #94a3b8',
                      color: p.phone ? '#1e293b' : '#94a3b8',
                      fontWeight: p.phone ? 600 : 400
                    }}
                    title="Click to edit phone number"
                  >
                    {p.phone ? `📞 ${p.phone}` : '+ Add Mobile'}
                  </span>
                )}
              </td>
              <td style={{ fontWeight: 700, color: Number(p.balance) > 0 ? '#b91c1c' : '#047857' }}>
                ₹{Number(p.balance).toLocaleString('en-IN')}
              </td>
              <td>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    style={{ height: '28px', padding: '0 8px', fontSize: '12px' }}
                    onClick={() => openSettlementModal(p)}
                    disabled={Number(p.balance) <= 0}
                  >
                    Receive Cash
                  </button>
                  <button
                    style={{
                      height: '28px',
                      padding: '0 8px',
                      fontSize: '12px',
                      backgroundColor: '#25D366',
                      borderColor: '#25D366',
                      color: '#ffffff'
                    }}
                    onClick={() => handleSendWhatsApp(p)}
                    disabled={Number(p.balance) <= 0}
                    title="Send WhatsApp payment reminder"
                  >
                    📲 WhatsApp
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ height: '28px', padding: '0 8px', fontSize: '12px' }}
                    onClick={() => handleSendSMS(p)}
                    disabled={Number(p.balance) <= 0}
                    title="Send standard text SMS"
                  >
                    💬 SMS
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr>
              <td colSpan={isAllBranches ? 5 : 4} style={{ textAlign: 'center', color: '#888', padding: '16px' }}>
                No customers found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h1 style={{ fontSize: '16px', marginTop: '24px' }}>Suppliers (Payables)</h1>
      <table>
        <thead>
          <tr>
            {isAllBranches && <th>Branch</th>}
            <th>Supplier</th>
            <th>Balance Owed (₹)</th>
            <th style={{ width: '130px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((p) => (
            <tr key={p.id}>
              {isAllBranches && <td><strong>{p.branch?.name || '-'}</strong></td>}
              <td>{p.name}</td>
              <td style={{ fontWeight: 600 }}>₹{Number(p.balance).toLocaleString('en-IN')}</td>
              <td>
                <button
                  className="btn-secondary"
                  style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                  onClick={() => openSettlementModal(p)}
                  disabled={Number(p.balance) <= 0}
                >
                  Pay Supplier
                </button>
              </td>
            </tr>
          ))}
          {suppliers.length === 0 && (
            <tr>
              <td colSpan={isAllBranches ? 4 : 3} style={{ textAlign: 'center', color: '#888', padding: '16px' }}>
                No suppliers found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Payment Settlement Modal */}
      {activeParty && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal" style={{ width: '380px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#0f172a' }}>
              {activeParty.type === 'customer' ? 'Receive Payment' : 'Pay Supplier'}
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Party: <strong>{activeParty.name}</strong> <br />
              Current Balance: <strong>₹{activeParty.balance}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="number"
                placeholder="Amount to settle (₹)"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                autoFocus
              />
              <input
                type="text"
                placeholder="Note / Reference (e.g. UPI Ref / Cash)"
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
              />
            </div>

            <div className="invoice-actions" style={{ marginTop: '20px' }}>
              <button onClick={handleSettlePayment} disabled={loading}>
                {loading ? 'Saving...' : 'Confirm Payment'}
              </button>
              <button className="btn-secondary" onClick={closeSettlementModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Parties;
import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Dashboard() {
  const { selectedBranch } = useContext(BranchContext);

  const [todaysCash, setTodaysCash] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [stockValue, setStockValue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    if (selectedBranch) {
      loadDashboardMetrics();
    }
  }, [selectedBranch]);

  async function loadDashboardMetrics() {
    try {
      // 1. Fetch Sales for Today's Cash
      let salesQuery = supabase.from('sales').select('*');
      if (selectedBranch !== 'ALL') {
        salesQuery = salesQuery.eq('branch_id', selectedBranch);
      }
      const { data: salesData } = await salesQuery;

      if (salesData) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const cashToday = salesData
          .filter((s) => {
            const saleDate = s.created_at ? s.created_at.slice(0, 10) : '';
            return saleDate === todayStr && s.payment_type === 'Cash';
          })
          .reduce((sum, s) => sum + Number(s.total || 0), 0);

        setTodaysCash(cashToday);
      }

      // 2. Fetch Parties for Total Due (Credit / Debit balances)
      let partiesQuery = supabase.from('parties').select('*');
      if (selectedBranch !== 'ALL') {
        partiesQuery = partiesQuery.eq('branch_id', selectedBranch);
      }
      const { data: partiesData } = await partiesQuery;

      if (partiesData) {
        const dueAmount = partiesData
          .filter((p) => p.balance_type !== 'Credit') // Customers who owe you money
          .reduce((sum, p) => sum + Number(p.balance || 0), 0);

        setTotalDue(dueAmount);
      }

      // 3. Fetch Items for Stock Value & Low Stock count
      let itemsQuery = supabase.from('items').select('*');
      if (selectedBranch !== 'ALL') {
        itemsQuery = itemsQuery.eq('branch_id', selectedBranch);
      }
      const { data: itemsData } = await itemsQuery;

      if (itemsData) {
        const totalVal = itemsData.reduce(
          (sum, item) => sum + (Number(item.stock || 0) * Number(item.rate || 0)),
          0
        );
        const lowItems = itemsData.filter((item) => Number(item.stock || 0) <= 10).length;

        setStockValue(Math.round(totalVal));
        setLowStockCount(lowItems);
      }
    } catch (err) {
      console.error('Error loading metrics:', err);
    }
  }

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <div className="cards">
        <div className="card">
          <div className="card-label">TODAY'S CASH</div>
          <div className="card-value">₹{todaysCash.toLocaleString('en-IN')}</div>
        </div>

        <div className="card card-blue">
          <div className="card-label">TOTAL DUE (RECEIVABLE)</div>
          <div className="card-value">₹{totalDue.toLocaleString('en-IN')}</div>
        </div>

        <div className="card">
          <div className="card-label">STOCK VALUE</div>
          <div className="card-value">₹{stockValue.toLocaleString('en-IN')}</div>
        </div>

        <div className="card card-blue">
          <div className="card-label">LOW STOCK ITEMS</div>
          <div className="card-value">{lowStockCount}</div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { BranchContext } from '../BranchContext';

function Dashboard() {
  const selectedBranch = useContext(BranchContext);

  const [items, setItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [parties, setParties] = useState([]);

  useEffect(() => {
    if (selectedBranch) {
      fetchData();
    }
  }, [selectedBranch]);

  async function fetchData() {
    let itemsQuery = supabase.from('items').select('*');
    let salesQuery = supabase.from('sales').select('*');
    let partiesQuery = supabase.from('parties').select('*');

    // If NOT in consolidated mode, filter by the specific branch
    if (selectedBranch !== 'ALL') {
      itemsQuery = itemsQuery.eq('branch_id', selectedBranch);
      salesQuery = salesQuery.eq('branch_id', selectedBranch);
      partiesQuery = partiesQuery.eq('branch_id', selectedBranch);
    }

    const [{ data: itemsData }, { data: salesData }, { data: partiesData }] =
      await Promise.all([itemsQuery, salesQuery, partiesQuery]);

    setItems(itemsData || []);
    setSales(salesData || []);
    setParties(partiesData || []);
  }

  const today = new Date().toLocaleDateString();

  const todaysCash = sales
    .filter(
      (sale) =>
        new Date(sale.created_at).toLocaleDateString() === today &&
        sale.payment_type === 'Cash'
    )
    .reduce((sum, sale) => sum + Number(sale.total), 0);

  const totalDue = parties
    .filter((p) => p.type === 'customer')
    .reduce((sum, p) => sum + Number(p.balance), 0);

  const stockValue = items.reduce(
    (sum, item) => sum + Number(item.stock) * Number(item.rate),
    0
  );

  const lowStockItems = items.filter((item) => Number(item.stock) < 100);

  return (
    <div className="page">
      <h1>
        Dashboard {selectedBranch === 'ALL' && <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>(Consolidated Overview)</span>}
      </h1>
      <div className="cards">
        <div className="card">
          <p className="card-label">Today's cash</p>
          <p className="card-value">₹{todaysCash}</p>
        </div>
        <div className="card card-blue">
          <p className="card-label">Total due</p>
          <p className="card-value">₹{totalDue}</p>
        </div>
        <div className="card">
          <p className="card-label">Stock value</p>
          <p className="card-value">₹{stockValue}</p>
        </div>
        <div className="card card-blue">
          <p className="card-label">Low stock items</p>
          <p className="card-value">{lowStockItems.length}</p>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h1 style={{ fontSize: '16px' }}>Low stock alerts</h1>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>In Stock</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    {item.stock} {item.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
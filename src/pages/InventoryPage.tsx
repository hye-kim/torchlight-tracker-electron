import React from 'react';
import InventoryView from '../components/InventoryView';
import { useInventoryStore } from '../stores';

const InventoryPage: React.FC = () => {
  const { bagInventory } = useInventoryStore();

  return (
    <div className="inventory-panel">
      <InventoryView drops={bagInventory} />
    </div>
  );
};

export default InventoryPage;

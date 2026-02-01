import React, { useState, useMemo } from 'react';
import './InventoryView.css';

interface Drop {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  type: string;
  timestamp: number;
  imageUrl?: string;
}

interface InventoryItem {
  itemId: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  type: string;
}

interface InventoryViewProps {
  drops: Drop[];
}

type SortOption = 'name-asc' | 'name-desc' | 'value-desc' | 'value-asc' | 'quantity-desc' | 'type';

const InventoryView: React.FC<InventoryViewProps> = ({ drops }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('value-desc');
  const [filterType, setFilterType] = useState<string>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Aggregate drops into inventory items
  const inventoryItems = useMemo(() => {
    const itemMap = new Map<string, InventoryItem>();

    drops.forEach((drop) => {
      const existing = itemMap.get(drop.itemId);
      if (existing) {
        existing.quantity += drop.quantity;
        existing.totalValue = existing.quantity * existing.unitPrice;
      } else {
        itemMap.set(drop.itemId, {
          itemId: drop.itemId,
          name: drop.name,
          imageUrl: drop.imageUrl,
          quantity: drop.quantity,
          unitPrice: drop.price,
          totalValue: drop.quantity * drop.price,
          type: drop.type,
        });
      }
    });

    return Array.from(itemMap.values());
  }, [drops]);

  // Filter items
  const filteredItems = useMemo(() => {
    let items = inventoryItems;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(query));
    }

    // Filter by type
    if (filterType !== 'all') {
      items = items.filter((item) => item.type === filterType);
    }

    return items;
  }, [inventoryItems, searchQuery, filterType]);

  // Sort items
  const sortedItems = useMemo(() => {
    const items = [...filteredItems];

    switch (sortBy) {
      case 'name-asc':
        return items.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return items.sort((a, b) => b.name.localeCompare(a.name));
      case 'value-desc':
        return items.sort((a, b) => b.totalValue - a.totalValue);
      case 'value-asc':
        return items.sort((a, b) => a.totalValue - b.totalValue);
      case 'quantity-desc':
        return items.sort((a, b) => b.quantity - a.quantity);
      case 'type':
        return items.sort((a, b) => a.type.localeCompare(b.type));
      default:
        return items;
    }
  }, [filteredItems, sortBy]);

  // Group items by type
  const groupedItems = useMemo(() => {
    const groups = new Map<string, InventoryItem[]>();

    sortedItems.forEach((item) => {
      const group = groups.get(item.type) || [];
      group.push(item);
      groups.set(item.type, group);
    });

    return groups;
  }, [sortedItems]);

  // Calculate totals
  const totalValue = useMemo(() => {
    return inventoryItems.reduce((sum, item) => sum + item.totalValue, 0);
  }, [inventoryItems]);

  const totalItems = inventoryItems.length;

  // Get unique types for filter
  const types = useMemo(() => {
    const typeSet = new Set(inventoryItems.map((item) => item.type));
    return Array.from(typeSet).sort();
  }, [inventoryItems]);

  const toggleGroup = (type: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(type)) {
      newCollapsed.delete(type);
    } else {
      newCollapsed.add(type);
    }
    setCollapsedGroups(newCollapsed);
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="inventory-view">
      <div className="inventory-header">
        <div className="inventory-title">INVENTORY</div>
        <div className="inventory-total-value">{formatCurrency(totalValue)} FE</div>
        <div className="inventory-item-count">Items: {totalItems}</div>
      </div>

      <div className="inventory-toolbar">
        <div className="inventory-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="inventory-dropdown"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
        >
          <option value="value-desc">Value (High to Low)</option>
          <option value="value-asc">Value (Low to High)</option>
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
          <option value="quantity-desc">Quantity</option>
          <option value="type">Type</option>
        </select>

        <select
          className="inventory-dropdown"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All Types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="inventory-content">
        {groupedItems.size === 0 ? (
          <div className="inventory-empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-message">No items found</div>
            <div className="empty-hint">Try adjusting your search or filter</div>
          </div>
        ) : (
          Array.from(groupedItems.entries()).map(([type, items]) => {
            const groupValue = items.reduce((sum, item) => sum + item.totalValue, 0);
            const isCollapsed = collapsedGroups.has(type);

            return (
              <div key={type} className="inventory-group">
                <button
                  className={`inventory-group-header ${isCollapsed ? 'collapsed' : ''}`}
                  onClick={() => toggleGroup(type)}
                  aria-expanded={!isCollapsed}
                  aria-controls={`group-${type}`}
                >
                  <svg className="inventory-group-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  <span className="inventory-group-title">{type.toUpperCase()}</span>
                  <span className="inventory-group-meta">
                    ({items.length} items, {formatCurrency(groupValue)} FE)
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="inventory-item-list" id={`group-${type}`}>
                    {items.map((item) => (
                      <div key={item.itemId} className="inventory-item">
                        <div className="inventory-item-image-wrapper">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="inventory-item-image" />
                          ) : (
                            <div className="inventory-item-image-placeholder" />
                          )}
                          {item.quantity > 1 && (
                            <span className="inventory-item-quantity">x{item.quantity}</span>
                          )}
                        </div>
                        <div className="inventory-item-details">
                          <div className="inventory-item-name">{item.name}</div>
                          <div className="inventory-item-pricing">
                            <span className="inventory-item-unit-price">
                              {formatCurrency(item.unitPrice)} FE each
                            </span>
                            <span className="inventory-pricing-separator">|</span>
                            <span className="inventory-item-total-value">
                              {formatCurrency(item.totalValue)} FE total
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default InventoryView;

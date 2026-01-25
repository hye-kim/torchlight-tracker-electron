import { useState } from 'react';
import './LootSummaryDropdown.css';

interface Drop {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  type: string;
  timestamp: number;
  imageUrl?: string;
}

interface LootSummaryDropdownProps {
  drops: Drop[];
  costs: Drop[];
  totalPickedUp: number;
  totalCost: number;
}

function LootSummaryDropdown({ drops, costs, totalPickedUp, totalCost }: LootSummaryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const totalProfit = totalPickedUp - totalCost;

  const handleToggle = () => {
    setIsOpen(!isOpen);

    // Adjust window height when toggling
    if (window.electronAPI) {
      setTimeout(() => {
        const contentHeight = document.querySelector('.loot-summary-content')?.scrollHeight || 0;
        const baseHeight = 600;
        const newHeight = !isOpen ? baseHeight + Math.min(contentHeight, 400) : baseHeight;

        // This would need an IPC handler to resize the window
        // For now, the CSS will handle the overflow
      }, 100);
    }
  };

  // Handle mouse events for click-through mode
  const handleMouseEnter = () => {
    if (window.electronAPI) {
      window.electronAPI.setIgnoreMouseEvents(false);
    }
  };

  const handleMouseLeave = () => {
    if (window.electronAPI) {
      // Re-check config to restore click-through if enabled
      window.electronAPI.getConfig().then((config: any) => {
        if (config.clickThrough) {
          window.electronAPI.setIgnoreMouseEvents(true);
        }
      });
    }
  };

  return (
    <div
      className="loot-summary-dropdown"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className="loot-summary-toggle"
        onClick={handleToggle}
      >
        <span>Loot Summary</span>
        <span className={`arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="loot-summary-content">
          <div className="loot-summary-section">
            <h3>Drops ({drops.length} items)</h3>
            <div className="loot-items">
              {drops.length > 0 ? (
                drops.map((drop) => (
                  <div key={drop.itemId} className="loot-item">
                    <span className="item-name">{drop.name}</span>
                    <span className="item-quantity">×{drop.quantity}</span>
                    <span className="item-value">
                      {(drop.price * drop.quantity).toFixed(2)} FE
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty-state">No drops yet</div>
              )}
            </div>
            <div className="section-total">
              <span>Total Revenue:</span>
              <span className="value positive">{totalPickedUp.toFixed(2)} FE</span>
            </div>
          </div>

          <div className="loot-summary-section">
            <h3>Costs ({costs.length} items)</h3>
            <div className="loot-items">
              {costs.length > 0 ? (
                costs.map((cost) => (
                  <div key={cost.itemId} className="loot-item">
                    <span className="item-name">{cost.name}</span>
                    <span className="item-quantity">×{cost.quantity}</span>
                    <span className="item-value">
                      {(cost.price * cost.quantity).toFixed(2)} FE
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty-state">No costs yet</div>
              )}
            </div>
            <div className="section-total">
              <span>Total Cost:</span>
              <span className="value negative">{totalCost.toFixed(2)} FE</span>
            </div>
          </div>

          <div className="loot-summary-footer">
            <span>Net Profit:</span>
            <span className={`value ${totalProfit >= 0 ? 'positive' : 'negative'}`}>
              {totalProfit.toFixed(2)} FE
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default LootSummaryDropdown;

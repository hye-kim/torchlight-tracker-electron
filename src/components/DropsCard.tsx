import { useState } from 'react';
import './DropsCard.css';

interface Drop {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  type: string;
  timestamp: number;
  imageUrl?: string;
}

type LootView = 'drops' | 'costs';

interface DropsCardProps {
  drops: Drop[];
  costs: Drop[];
  totalPickedUp: number;
  totalCost: number;
  selectedMapName?: string;
}

// Type colors for the percentage bar
const TYPE_COLORS: Record<string, string> = {
  // Currency & Universal
  'universal item': '#8b5cf6',
  currency: '#8b5cf6',

  // Embers & Ashes
  ember: '#f97316',
  ashes: '#f59e0b',

  // Compass
  compass: '#3b82f6',
  'season compass': '#3b82f6',

  // Fuel & Glow
  fuel: '#10b981',
  glow: '#10b981',

  // Memories
  'fluorescent memory': '#ec4899',
  memory: '#ec4899',
  'memory scrap': '#ec4899',
  'memory thread': '#ec4899',

  // Divine & God Items
  'divine emblem': '#facc15',
  'divinity fragment': '#facc15',
  'divinity stone': '#facc15',
  'god of conquest': '#facc15',
  'god of fraud': '#facc15',
  'god of hunt': '#facc15',
  'god of knowledge': '#facc15',
  'god of machines': '#facc15',
  'god of strength': '#facc15',

  // Beacons
  beacon: '#06b6d4',

  // Prisms
  'dimensional prism': '#14b8a6',
  'prism calibrator': '#14b8a6',
  'prism level': '#14b8a6',
  'prism repairer': '#14b8a6',
  特殊棱镜: '#14b8a6',

  // Cores & Organs
  'desire core': '#a855f7',
  'primordial core': '#a855f7',
  'common organ': '#78716c',
  'core organ - amulet': '#78716c',
  'core organ - belt': '#78716c',
  'core organ - boots': '#78716c',
  'core organ - chest': '#78716c',
  'core organ - gloves': '#78716c',
  'core organ - head': '#78716c',
  'core organ - ring': '#78716c',
  'special organ - other': '#78716c',
  'addicted limb': '#78716c',

  // Perfect Organs
  'perfect embryo - summon': '#c084fc',
  'perfect eyes - debuff': '#c084fc',
  'perfect heart - buff': '#c084fc',
  'perfect liver - conversion': '#c084fc',
  'perfect skin - defense': '#c084fc',
  'perfect throat - blessing': '#c084fc',
  'perfect wings - duration': '#c084fc',

  // Skills
  'active skill': '#60a5fa',
  'passive skill': '#60a5fa',
  'support skill': '#60a5fa',
  'activation medium skill': '#60a5fa',
  'magnificent support skill': '#60a5fa',
  'noble support skill': '#60a5fa',

  // Crafting & Materials
  'imprinting iron': '#71717a',
  component: '#71717a',
  'cutting instrument': '#71717a',
  stitching: '#71717a',
  'erosion materials': '#71717a',
  fossil: '#71717a',

  // Special Items
  'ascension wedge': '#fb923c',
  'unifying wedge': '#fb923c',
  'dark tide decree': '#dc2626',
  'dream whisper': '#a78bfa',
  'eternal labyrinth': '#fbbf24',
  'labyrinth echo': '#fbbf24',
  'inverse image echo': '#fbbf24',
  fate: '#f472b6',
  命运相关: '#f472b6',
  'fog city tales': '#94a3b8',
  'legendary gear': '#fcd34d',
  装备蓝图: '#fcd34d',
  pactspirit: '#f0abfc',
  probe: '#38bdf8',
  'proof of valor': '#fbbf24',
  "queen's grace": '#f9a8d4',
  "queen's wick": '#f9a8d4',
  'snowy canvas': '#e0f2fe',
  'special item': '#a3e635',
  spice: '#fdba74',
  'tower chips': '#94a3b8',
  'void sea invitation': '#6366f1',

  // Fallbacks
  others: '#6b7280',
  unknown: '#9ca3af',
};

function getTypeColor(type: string): string {
  const normalizedType = type.toLowerCase();
  return TYPE_COLORS[normalizedType] ?? TYPE_COLORS.unknown;
}

function DropsCard({
  drops,
  costs,
  totalPickedUp,
  totalCost,
  selectedMapName,
}: DropsCardProps): JSX.Element {
  const [lootView, setLootView] = useState<LootView>('drops');

  // Sort drops by total FE value (price * quantity) descending
  const sortedDrops = [...drops].sort((a, b) => {
    const aTotal = a.price * a.quantity;
    const bTotal = b.price * b.quantity;
    return bTotal - aTotal;
  });

  // Sort costs by total FE value descending
  const sortedCosts = [...costs].sort((a, b) => {
    const aTotal = a.price * a.quantity;
    const bTotal = b.price * b.quantity;
    return bTotal - aTotal;
  });

  // Calculate FE totals by item type for the percentage bar (loot only)
  const typeBreakdown = sortedDrops.reduce(
    (acc, item) => {
      const type = (item.type ?? 'unknown').toLowerCase();
      const total = item.price * item.quantity;
      acc[type] = (acc[type] ?? 0) + total;
      return acc;
    },
    {} as Record<string, number>
  );

  // Get sorted types by FE value for consistent display
  const sortedTypes = Object.entries(typeBreakdown)
    .sort(([, a], [, b]) => b - a)
    .filter(([, value]) => value > 0);

  const totalProfit = totalPickedUp - totalCost;

  return (
    <div className="drops-card">
      <div className="drops-header">
        <h2>{selectedMapName ? `Loot: ${selectedMapName}` : 'Loot Summary'}</h2>
      </div>

      {/* Loot View Tabs */}
      <div className="loot-view-tabs">
        <button
          className={`tab-button ${lootView === 'drops' ? 'active' : ''}`}
          onClick={() => setLootView('drops')}
        >
          Drops
        </button>
        <button
          className={`tab-button ${lootView === 'costs' ? 'active' : ''}`}
          onClick={() => setLootView('costs')}
        >
          Costs
        </button>
      </div>

      {/* FE Percentage Bar by Item Type */}
      {totalPickedUp > 0 && lootView !== 'costs' && (
        <div className="type-breakdown">
          <div className="percentage-bar">
            {sortedTypes.map(([type, value]) => {
              const percentage = (value / totalPickedUp) * 100;
              const color = getTypeColor(type);
              return (
                <div
                  key={type}
                  className="percentage-segment"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: color,
                  }}
                  title={`${type}: ${value.toFixed(2)} FE (${percentage.toFixed(1)}%)`}
                />
              );
            })}
          </div>
          <div className="type-legend">
            {sortedTypes.map(([type, value]) => {
              const percentage = (value / totalPickedUp) * 100;
              const color = getTypeColor(type);
              return (
                <div key={type} className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: color }} />
                  <span className="legend-label">{type}</span>
                  <span className="legend-value">{percentage.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="drops-list">
        {sortedDrops.length === 0 && sortedCosts.length === 0 ? (
          <div className="no-drops">
            {selectedMapName ? 'No items for this map' : 'Select a map to view loot'}
          </div>
        ) : (
          <>
            {/* Drops Section */}
            {lootView === 'drops' &&
              sortedDrops.map((item, index) => {
                const totalFE = item.price * item.quantity;
                return (
                  <div key={`drop-${item.itemId}-${index}`} className="drop-item">
                    <div className="drop-main">
                      <div className="drop-left">
                        <div className="item-image-wrapper">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="item-image" />
                          ) : (
                            <div className="item-image-placeholder" />
                          )}
                          <div className="quantity-badge">{item.quantity}</div>
                        </div>
                        <div className="drop-name">{item.name}</div>
                      </div>
                      <div className="drop-right">
                        <div className="price-row">
                          <span className="price-label">Unit Price</span>
                          <span className="price-value">{item.price.toFixed(2)}</span>
                        </div>
                        <div className="price-row total-row">
                          <span className="price-label">Total Value</span>
                          <span className="price-value positive">{totalFE.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="drop-info">
                      <span className="drop-type">{item.type || 'Unknown'}</span>
                    </div>
                  </div>
                );
              })}

            {/* Costs Section */}
            {lootView === 'costs' && sortedCosts.length > 0 && (
              <>
                {sortedCosts.map((item, index) => {
                  const totalFE = item.price * item.quantity;
                  return (
                    <div key={`cost-${item.itemId}-${index}`} className="drop-item cost-item">
                      <div className="drop-main">
                        <div className="drop-left">
                          <div className="item-image-wrapper">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="item-image" />
                            ) : (
                              <div className="item-image-placeholder" />
                            )}
                            <div className="quantity-badge">{item.quantity}</div>
                          </div>
                          <div className="drop-name">{item.name}</div>
                        </div>
                        <div className="drop-right">
                          <div className="price-row">
                            <span className="price-label">Unit Price</span>
                            <span className="price-value">{item.price.toFixed(2)}</span>
                          </div>
                          <div className="price-row total-row">
                            <span className="price-label">Total Value</span>
                            <span className="price-value negative">-{totalFE.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="drop-info">
                        <span className="drop-type">{item.type || 'Unknown'}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>

      {/* Summary Footer */}
      {(sortedDrops.length > 0 || sortedCosts.length > 0) && (
        <div className="drops-footer">
          <div className="summary-row">
            <span className="summary-label">Picked Up</span>
            <span className="summary-value positive">{totalPickedUp.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Cost</span>
            <span className="summary-value negative">-{totalCost.toFixed(2)}</span>
          </div>
          <div className="summary-row profit-row">
            <span className="summary-label">Profit</span>
            <span className={`summary-value ${totalProfit >= 0 ? 'positive' : 'negative'}`}>
              {totalProfit >= 0 ? '' : '-'}
              {Math.abs(totalProfit).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default DropsCard;

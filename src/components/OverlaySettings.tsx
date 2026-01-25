import { useState, useEffect } from 'react';
import './OverlaySettings.css';

interface DisplayItem {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

interface OverlaySettingsProps {
  config: {
    overlayMode?: boolean;
    clickThrough?: boolean;
    fontSize?: number;
    displayItems?: DisplayItem[];
  };
  onSave: (updates: any) => void;
  onClose: () => void;
}

function OverlaySettings({ config, onSave, onClose }: OverlaySettingsProps) {
  const [overlayMode, setOverlayMode] = useState(config.overlayMode ?? false);
  const [clickThrough, setClickThrough] = useState(config.clickThrough ?? false);
  const [fontSize, setFontSize] = useState(config.fontSize ?? 14);
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>(
    config.displayItems ?? [
      { id: 'status', label: 'Status: Not Recording / Recording', enabled: true, order: 0 },
      { id: 'currentMap', label: 'Current Map', enabled: true, order: 1 },
      { id: 'currentProfitPerMin', label: 'Current Profit / min', enabled: true, order: 2 },
      { id: 'currentProfit', label: 'Current Profit', enabled: true, order: 3 },
      { id: 'totalProfitPerMin', label: 'Total Profit / min', enabled: true, order: 4 },
      { id: 'totalProfit', label: 'Total Profit', enabled: true, order: 5 },
      { id: 'mapDuration', label: 'Map Duration', enabled: true, order: 6 },
      { id: 'totalDuration', label: 'Total Duration', enabled: true, order: 7 },
      { id: 'mapCount', label: 'Map Count', enabled: true, order: 8 },
    ]
  );
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  // Sort displayItems by order
  const sortedItems = [...displayItems].sort((a, b) => a.order - b.order);

  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;

    const newItems = [...sortedItems];
    const draggedItemData = newItems[draggedItem];
    newItems.splice(draggedItem, 1);
    newItems.splice(index, 0, draggedItemData);

    // Update order values
    const updatedItems = newItems.map((item, idx) => ({
      ...item,
      order: idx,
    }));

    setDisplayItems(updatedItems);
    setDraggedItem(index);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const toggleItemEnabled = (id: string) => {
    setDisplayItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  const handleSave = async () => {
    const updates = {
      overlayMode,
      clickThrough,
      fontSize,
      displayItems,
    };

    // Save config
    await onSave(updates);

    // Apply overlay mode and click-through settings
    if (window.electronAPI) {
      await window.electronAPI.toggleOverlayMode(overlayMode);
      await window.electronAPI.toggleClickThrough(clickThrough);
      await window.electronAPI.setFontSize(fontSize);
      await window.electronAPI.setDisplayItems(displayItems);
    }

    onClose();
  };

  // Handle mouse events for click-through mode
  const handleMouseEnter = () => {
    if (window.electronAPI) {
      window.electronAPI.setIgnoreMouseEvents(false);
    }
  };

  const handleMouseLeave = () => {
    if (window.electronAPI && config.clickThrough) {
      window.electronAPI.setIgnoreMouseEvents(true);
    }
  };

  return (
    <div
      className="dialog-overlay"
      onClick={onClose}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="dialog-content overlay-settings" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Overlay Settings</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="dialog-body">
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={overlayMode}
                onChange={(e) => setOverlayMode(e.target.checked)}
              />
              <span>Enable Overlay Mode</span>
            </label>
            <span className="form-hint">
              Makes the window transparent and always on top (requires restart)
            </span>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={clickThrough}
                onChange={(e) => setClickThrough(e.target.checked)}
              />
              <span>Enable Click-Through</span>
            </label>
            <span className="form-hint">
              Allows clicks to pass through the window to the game
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="fontSize">Font Size: {fontSize}px</label>
            <input
              id="fontSize"
              type="range"
              min="8"
              max="32"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label>Display Items</label>
            <span className="form-hint">Drag to reorder, uncheck to hide</span>
            <div className="display-items-list">
              {sortedItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`display-item ${draggedItem === index ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="drag-handle">⋮⋮</span>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => toggleItemEnabled(item.id)}
                    />
                    <span>{item.label}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default OverlaySettings;

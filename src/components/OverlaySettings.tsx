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
  onSave: (updates: { fontSize?: number; displayItems?: DisplayItem[] }) => void;
  onClose: () => void;
}

function OverlaySettings({ config, onSave, onClose }: OverlaySettingsProps): JSX.Element {
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

  // Apply changes in real-time
  useEffect(() => {
    if (window.electronAPI) {
      void window.electronAPI.setFontSize(fontSize);
      onSave({ fontSize });
    }
  }, [fontSize, onSave]);

  useEffect(() => {
    if (window.electronAPI) {
      void window.electronAPI.setDisplayItems(displayItems);
      onSave({ displayItems });
    }
  }, [displayItems, onSave]);

  // Sort displayItems by order
  const sortedItems = [...displayItems].sort((a, b) => a.order - b.order);

  const handleDragStart = (index: number): void => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number): void => {
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

  const handleDragEnd = (): void => {
    setDraggedItem(null);
  };

  const toggleItemEnabled = (id: string): void => {
    setDisplayItems((items) =>
      items.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    );
  };

  const handleClose = (): void => {
    // Final save on close
    const updates = {
      fontSize,
      displayItems,
    };
    onSave(updates);
    onClose();
  };

  // Handle mouse events for click-through mode
  const handleMouseEnter = (): void => {
    if (window.electronAPI) {
      void window.electronAPI.setIgnoreMouseEvents(false);
    }
  };

  const handleMouseLeave = (): void => {
    // Don't enable click-through while dialog is open
    // This prevents the dialog from becoming unresponsive
  };

  return (
    <div className="dialog-overlay" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="dialog-content overlay-settings" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Display Settings</h2>
          <button className="close-btn" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="dialog-body">
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
          <button className="btn-primary" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default OverlaySettings;

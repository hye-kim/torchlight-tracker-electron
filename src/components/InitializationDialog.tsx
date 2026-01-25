import { useState, useEffect } from 'react';
import './InitializationDialog.css';

interface InitializationDialogProps {
  onClose: () => void;
}

function InitializationDialog({ onClose }: InitializationDialogProps) {
  const [canClose, setCanClose] = useState(false);

  // Prevent closing immediately after opening
  useEffect(() => {
    const timer = setTimeout(() => setCanClose(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking directly on the overlay, not on child elements, and after initial render
    if (canClose && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div className="init-dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>🎯 Tracker Initialization</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="dialog-body">
          <div className="instruction-section">
            <h3>How to Initialize the Tracker</h3>
            <ol className="instruction-list">
              <li>
                <strong>Open your Inventory</strong> in Torchlight: Infinite
              </li>
              <li>
                <strong>Wait for Initialization</strong> - The tracker will scan your current inventory
              </li>
              <li>
                <strong>Enter a Map</strong> - Start running maps to begin tracking drops and statistics
              </li>
            </ol>
          </div>

          <div className="tip-section">
            <h4>💡 Tips:</h4>
            <ul>
              <li>Make sure the game is running before clicking "Initialize Tracker"</li>
              <li>The tracker monitors the game log file to detect items picked up and used</li>
              <li>All prices are automatically fetched from the API</li>
              <li>Tax calculation (12.5%) is enabled by default in Settings</li>
            </ul>
          </div>

          <div className="info-section">
            <h4>📊 What Gets Tracked:</h4>
            <ul>
              <li><strong>Loot:</strong> All items picked up while in a map</li>
              <li><strong>Costs:</strong> Items consumed when entering a map (compasses, tickets, etc.)</li>
              <li><strong>Revenue:</strong> Total value of items looted</li>
              <li><strong>Profit:</strong> Revenue minus costs</li>
              <li><strong>Duration:</strong> Time spent in each map</li>
            </ul>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn-primary" onClick={onClose}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}

export default InitializationDialog;

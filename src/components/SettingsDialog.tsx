import { useState } from 'react';
import './SettingsDialog.css';

interface Config {
  tax: number;
  user: string;
}

interface SettingsDialogProps {
  config: Config;
  onSave: (updates: Partial<Config>) => void;
  onClose: () => void;
}

function SettingsDialog({ config, onSave, onClose }: SettingsDialogProps) {
  const [tax, setTax] = useState(config.tax);
  const [user, setUser] = useState(config.user);

  const handleSave = () => {
    onSave({ tax, user });
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking directly on the overlay, not on child elements
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="dialog-body">
          <div className="form-group">
            <label htmlFor="tax">Tax Mode</label>
            <select id="tax" value={tax} onChange={(e) => setTax(parseInt(e.target.value))}>
              <option value={0}>No Tax</option>
              <option value={1}>Apply Tax (12.5%)</option>
            </select>
            <span className="form-hint">
              When enabled, prices will be calculated with 12.5% market tax
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="user">User ID (Optional)</label>
            <input
              id="user"
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="Enter your user ID"
            />
            <span className="form-hint">Used for tracking purposes</span>
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

export default SettingsDialog;

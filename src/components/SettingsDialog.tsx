import { useState, useEffect } from 'react';
import './SettingsDialog.css';

interface Config {
  tax: number;
  user: string;
}

interface UpdateConfig {
  autoCheck: boolean;
  lastCheckTime?: number;
}

interface SettingsDialogProps {
  config: Config;
  onSave: (updates: Partial<Config>) => void;
  onClose: () => void;
}

function SettingsDialog({ config, onSave, onClose }: SettingsDialogProps) {
  const [tax, setTax] = useState(config.tax);
  const [user, setUser] = useState(config.user);
  const [updateConfig, setUpdateConfig] = useState<UpdateConfig>({ autoCheck: true });
  const [appVersion, setAppVersion] = useState<string>('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [lastCheckMessage, setLastCheckMessage] = useState<string>('');

  useEffect(() => {
    // Load update config and app version
    window.electronAPI.getUpdateConfig().then(setUpdateConfig);
    window.electronAPI.getAppVersion().then(setAppVersion);
  }, []);

  const handleSave = () => {
    onSave({ tax, user });
    // Save update config separately
    window.electronAPI.setUpdateConfig(updateConfig);
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    setLastCheckMessage('Checking for updates...');
    try {
      const result = await window.electronAPI.checkForUpdates();
      if (result.success) {
        if (result.updateInfo) {
          setLastCheckMessage(`Update available: v${result.updateInfo.version}`);
        } else {
          setLastCheckMessage('You are up to date!');
        }
      } else {
        setLastCheckMessage('Failed to check for updates');
      }
    } catch (error) {
      setLastCheckMessage('Error checking for updates');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const formatLastCheckTime = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="dialog-overlay">
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

          <div className="form-section-divider"></div>

          <div className="form-section-title">Updates</div>

          <div className="form-group">
            <div className="update-info-row">
              <span className="update-label">Current Version:</span>
              <span className="update-value">v{appVersion}</span>
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={updateConfig.autoCheck}
                onChange={(e) => setUpdateConfig({ ...updateConfig, autoCheck: e.target.checked })}
              />
              <span>Check for updates on startup</span>
            </label>
            <span className="form-hint">
              Automatically check for new versions when the application starts
            </span>
          </div>

          <div className="form-group">
            <button
              className="btn-check-updates"
              onClick={handleCheckForUpdates}
              disabled={isCheckingUpdate}
            >
              {isCheckingUpdate ? 'Checking...' : 'Check for Updates Now'}
            </button>
            {lastCheckMessage && <span className="update-check-message">{lastCheckMessage}</span>}
            {updateConfig.lastCheckTime && (
              <span className="form-hint">
                Last checked: {formatLastCheckTime(updateConfig.lastCheckTime)}
              </span>
            )}
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

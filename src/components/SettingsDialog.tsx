import { useState, useEffect } from 'react';
import './SettingsDialog.css';

interface Config {
  tax: number;
  user: string;
}

interface LocalUpdateConfig {
  autoCheck: boolean;
}

interface SettingsDialogProps {
  config: Config;
  onSave: (updates: Partial<Config>) => void;
  onClose: () => void;
}

function SettingsDialog({ config, onSave, onClose }: SettingsDialogProps): JSX.Element {
  const [tax, setTax] = useState(config.tax);
  const [user, setUser] = useState(config.user);
  const [updateConfig, setUpdateConfig] = useState<LocalUpdateConfig>({ autoCheck: true });
  const [appVersion, setAppVersion] = useState<string>('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [lastCheckMessage, setLastCheckMessage] = useState<string>('');

  useEffect(() => {
    // Load update config and app version
    void window.electronAPI.getUpdateConfig().then((config) => {
      setUpdateConfig({
        autoCheck: config.checkOnStartup,
      });
    });
    void window.electronAPI.getAppVersion().then(setAppVersion);
  }, []);

  const handleSave = (): void => {
    onSave({ tax, user });
    // Save update config separately - convert LocalUpdateConfig to UpdateConfig
    void window.electronAPI.setUpdateConfig({
      autoDownload: false,
      autoInstall: false,
      checkOnStartup: updateConfig.autoCheck,
      checkInterval: 3600000,
    });
  };

  const handleCheckForUpdates = async (): Promise<void> => {
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
    } catch {
      setLastCheckMessage('Error checking for updates');
    } finally {
      setIsCheckingUpdate(false);
    }
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
              onClick={() => void handleCheckForUpdates()}
              disabled={isCheckingUpdate}
            >
              {isCheckingUpdate ? 'Checking...' : 'Check for Updates Now'}
            </button>
            {lastCheckMessage && <span className="update-check-message">{lastCheckMessage}</span>}
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

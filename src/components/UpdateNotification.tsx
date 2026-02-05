import { useState, useEffect } from 'react';
import './UpdateNotification.css';

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseName?: string;
}

interface UpdateNotificationProps {
  updateInfo: UpdateInfo | null;
  onDownload: () => void;
  onDismiss: () => void;
  onSkip: () => void;
}

function UpdateNotification({
  updateInfo,
  onDownload,
  onDismiss,
  onSkip,
}: UpdateNotificationProps): JSX.Element | null {
  const [currentVersion, setCurrentVersion] = useState<string>('');

  useEffect(() => {
    void window.electronAPI.getAppVersion().then(setCurrentVersion);
  }, []);

  if (!updateInfo) return null;

  return (
    <div className="update-notification">
      <div className="update-notification-content">
        <div className="update-notification-icon">🎉</div>
        <div className="update-notification-text">
          <div className="update-notification-title">Update Available: v{updateInfo.version}</div>
          <div className="update-notification-subtitle">Current version: v{currentVersion}</div>
        </div>
        <div className="update-notification-actions">
          <button className="btn-primary" onClick={onDownload}>
            Download Update
          </button>
          <button className="btn-secondary" onClick={onDismiss}>
            Remind Later
          </button>
          <button className="btn-link" onClick={onSkip}>
            Skip Version
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpdateNotification;

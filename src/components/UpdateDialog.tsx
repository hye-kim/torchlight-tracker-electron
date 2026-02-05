import { useState, useEffect } from 'react';
import type { UpdateInfo, DownloadProgress } from '../types';
import './UpdateDialog.css';

interface UpdateDialogProps {
  updateInfo: UpdateInfo;
  onClose: () => void;
}

function UpdateDialog({ updateInfo, onClose }: UpdateDialogProps): JSX.Element {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');

  useEffect(() => {
    void window.electronAPI.getAppVersion().then(setCurrentVersion);

    // Listen for download progress
    window.electronAPI.onDownloadProgress((progressInfo) => {
      setProgress(progressInfo);
    });

    // Listen for download complete
    window.electronAPI.onUpdateDownloaded(() => {
      setIsDownloading(false);
      setIsDownloaded(true);
    });

    // Listen for errors
    window.electronAPI.onUpdateError((err) => {
      setError(err.message);
      setIsDownloading(false);
    });
  }, []);

  const handleDownload = async (): Promise<void> => {
    setIsDownloading(true);
    setError(null);
    try {
      await window.electronAPI.downloadUpdate();
    } catch (err: unknown) {
      const errorMessage =
        err && typeof err === 'object' && 'message' in err
          ? String(err.message)
          : 'Failed to download update';
      setError(errorMessage);
      setIsDownloading(false);
    }
  };

  const handleInstall = (): void => {
    void window.electronAPI.installUpdate();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-content update-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Software Update</h2>
          {!isDownloading && !isDownloaded && (
            <button className="close-btn" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        <div className="dialog-body">
          <div className="update-info">
            <div className="update-version-comparison">
              <div className="version-badge current">
                <span className="version-label">Current</span>
                <span className="version-number">v{currentVersion}</span>
              </div>
              <div className="version-arrow">→</div>
              <div className="version-badge new">
                <span className="version-label">New</span>
                <span className="version-number">v{updateInfo.version}</span>
              </div>
            </div>

            {!isDownloading && !isDownloaded && (
              <p className="update-description">
                A new version is available. Click &quot;Download Update&quot; to download and
                install it.
              </p>
            )}

            {isDownloading && progress && (
              <div className="download-progress">
                <div className="progress-info">
                  <span className="progress-label">Downloading update...</span>
                  <span className="progress-stats">
                    {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
                </div>
                <div className="progress-percentage">{progress.percent.toFixed(1)}%</div>
              </div>
            )}

            {isDownloaded && (
              <div className="update-ready">
                <div className="ready-icon">✅</div>
                <div className="ready-message">
                  <p className="ready-title">Update Ready!</p>
                  <p className="ready-description">
                    The update has been downloaded. Click &quot;Restart to Install&quot; to complete
                    the installation.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="update-error">
                <div className="error-icon">⚠️</div>
                <div className="error-message">
                  <p className="error-title">Update Failed</p>
                  <p className="error-description">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="dialog-footer">
          {!isDownloading && !isDownloaded && !error && (
            <>
              <button className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  void handleDownload();
                }}
              >
                Download Update
              </button>
            </>
          )}

          {isDownloaded && (
            <>
              <button className="btn-secondary" onClick={onClose}>
                Install Later
              </button>
              <button className="btn-primary btn-install" onClick={handleInstall}>
                Restart to Install
              </button>
            </>
          )}

          {error && (
            <>
              <button className="btn-secondary" onClick={onClose}>
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  void handleDownload();
                }}
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default UpdateDialog;

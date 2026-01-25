import './ControlCard.css';

interface ControlCardProps {
  onInitialize: () => void;
  onExportExcel: () => void;
  onExportDebugLog: () => void;
  onOpenSettings: () => void;
  onResetStats: () => void;
  isInitialized: boolean;
  isWaitingForInit: boolean;
}

function ControlCard({
  onInitialize,
  onExportExcel,
  onExportDebugLog,
  onOpenSettings,
  onResetStats,
  isInitialized,
  isWaitingForInit,
}: ControlCardProps) {
  return (
    <div className="control-card">
      <h2>Controls</h2>

      <div className="control-buttons">
        <button
          className="control-btn primary"
          onClick={onInitialize}
          disabled={isWaitingForInit || isInitialized}
        >
          <span className="btn-icon">🎯</span>
          {isInitialized ? 'Tracker Initialized' : isWaitingForInit ? 'Waiting for Initialization' : 'Initialize Tracker'}
        </button>

        <button className="control-btn" onClick={onExportExcel}>
          <span className="btn-icon">📊</span>
          Export to Excel
        </button>

        <button className="control-btn" onClick={onExportDebugLog}>
          <span className="btn-icon">📝</span>
          Export Debug Log
        </button>

        <button className="control-btn" onClick={onOpenSettings}>
          <span className="btn-icon">⚙️</span>
          Settings
        </button>

        <button className="control-btn danger" onClick={onResetStats}>
          <span className="btn-icon">🔄</span>
          Reset Statistics
        </button>
      </div>
    </div>
  );
}

export default ControlCard;

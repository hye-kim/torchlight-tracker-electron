import React from 'react';
import './ControlsBar.css';

interface ControlsBarProps {
  onInitialize: () => void;
  onExportExcel: () => void;
  onOpenSettings: () => void;
  onResetStats: () => void;
  isInitialized: boolean;
  isWaitingForInit: boolean;
}

const ControlsBar: React.FC<ControlsBarProps> = ({
  onInitialize,
  onExportExcel,
  onOpenSettings,
  onResetStats,
  isInitialized,
  isWaitingForInit,
}) => {
  return (
    <div className="controls-bar">
      <button
        className="control-btn primary"
        onClick={onInitialize}
        disabled={isWaitingForInit || isInitialized}
      >
        {isInitialized ? 'Tracker Initialized' : isWaitingForInit ? 'Initializing...' : 'Initialize Tracker'}
      </button>

      <button className="control-btn danger" onClick={onResetStats}>
        Reset Session
      </button>

      <button className="control-btn secondary" onClick={onExportExcel}>
        Export Data
      </button>

      <button className="control-btn icon" onClick={onOpenSettings} aria-label="Settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v6m0 6v6m5.657-13.657l-4.243 4.243m-2.828 2.828l-4.243 4.243m16.97-1.414l-6-6m-6 6l-6-6M23 12h-6m-6 0H1" />
        </svg>
      </button>
    </div>
  );
};

export default ControlsBar;

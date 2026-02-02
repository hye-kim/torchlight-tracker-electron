import React from 'react';
import './HistoryStatsPanel.css';

interface HistoryStatsPanelProps {
  stats: {
    totalProfit: number;
    totalRevenue: number;
    totalCost: number;
    mapsCompleted: number;
    duration: number;
    profitPerMinute: number;
    profitPerHour: number;
  };
  profitMode: 'perMinute' | 'perHour';
  onProfitModeToggle: () => void;
}

const HistoryStatsPanel: React.FC<HistoryStatsPanelProps> = ({
  stats,
  profitMode,
  onProfitModeToggle,
}) => {
  const formatProfit = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${Math.floor(value).toLocaleString()} FE`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const profitRateValue = profitMode === 'perMinute' ? stats.profitPerMinute : stats.profitPerHour;
  const profitRateLabel = profitMode === 'perMinute' ? 'Profit / Min' : 'Profit / Hour';

  return (
    <div className="history-stats-panel">
      <div className="history-stat-card">
        <div className="history-stat-label">Total Profit</div>
        <div className={`history-stat-value ${stats.totalProfit >= 0 ? 'positive' : 'negative'}`}>
          {formatProfit(stats.totalProfit)}
        </div>
      </div>

      <div className="history-stat-card">
        <div className="history-stat-label">Maps Completed</div>
        <div className="history-stat-value">{stats.mapsCompleted}</div>
      </div>

      <div className="history-stat-card">
        <div className="history-stat-label">Duration</div>
        <div className="history-stat-value">{formatDuration(stats.duration)}</div>
      </div>

      <div className="history-stat-card clickable" onClick={onProfitModeToggle}>
        <div className="history-stat-label">
          {profitRateLabel}
          <span className="toggle-indicator">⇄</span>
        </div>
        <div className={`history-stat-value ${profitRateValue >= 0 ? 'positive' : 'negative'}`}>
          {formatProfit(profitRateValue)}
        </div>
      </div>
    </div>
  );
};

export default HistoryStatsPanel;

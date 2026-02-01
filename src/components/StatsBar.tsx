import React from 'react';
import './StatsBar.css';

interface Stats {
  currentMap: {
    mapCount: number;
    duration: number;
    feIncome: number;
    incomePerMinute: number;
  };
  total: {
    mapCount: number;
    duration: number;
    feIncome: number;
    incomePerMinute: number;
  };
}

interface StatsBarProps {
  stats: Stats | null;
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`;
  }
  return value.toFixed(2);
};

const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  if (!stats) {
    return null;
  }

  const currentProfit = stats.currentMap.feIncome;
  const currentProfitPerMin = stats.currentMap.incomePerMinute;
  const totalProfit = stats.total.feIncome;
  const totalProfitPerMin = stats.total.incomePerMinute;

  return (
    <div className="stats-bar" role="status" aria-live="polite" aria-label="Session statistics">
      <div className="stats-row">
        <span className="stats-row-label">Current:</span>
        <div className="stats-items">
          <div className="stat-item">
            <span className="stat-label">Duration:</span>
            <span className="stat-value">{formatDuration(stats.currentMap.duration)}</span>
          </div>
          <span className="stat-separator">|</span>
          <div className="stat-item">
            <span className="stat-label">Profit:</span>
            <span className={`stat-value ${currentProfit >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(currentProfit)} FE
            </span>
          </div>
          <span className="stat-separator">|</span>
          <div className="stat-item">
            <span className="stat-label">P/m:</span>
            <span className={`stat-value ${currentProfitPerMin >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(currentProfitPerMin)} FE
            </span>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <span className="stats-row-label">Total:</span>
        <div className="stats-items">
          <div className="stat-item">
            <span className="stat-label">Duration:</span>
            <span className="stat-value">{formatDuration(stats.total.duration)}</span>
          </div>
          <span className="stat-separator">|</span>
          <div className="stat-item">
            <span className="stat-label">Maps:</span>
            <span className="stat-value">{stats.total.mapCount}</span>
          </div>
          <span className="stat-separator">|</span>
          <div className="stat-item">
            <span className="stat-label">Profit:</span>
            <span className={`stat-value ${totalProfit >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(totalProfit)} FE
            </span>
          </div>
          <span className="stat-separator">|</span>
          <div className="stat-item">
            <span className="stat-label">P/m:</span>
            <span className={`stat-value ${totalProfitPerMin >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(totalProfitPerMin)} FE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsBar;

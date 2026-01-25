import './StatsCard.css';

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

interface StatsCardProps {
  stats: Stats | null;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}

function StatsCard({ stats }: StatsCardProps) {
  if (!stats) {
    return (
      <div className="stats-card">
        <h2>Statistics</h2>
        <div className="no-stats">No data available</div>
      </div>
    );
  }

  return (
    <div className="stats-card">
      <h2>Statistics</h2>

      <div className="stats-section">
        <h3>Current Map</h3>
        <div className="stats-grid">
          <div className="stat-item full-width">
            <span className="stat-label">Duration</span>
            <span className="stat-value">{formatDuration(stats.currentMap.duration)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Profit</span>
            <span className="stat-value highlight">{stats.currentMap.feIncome.toFixed(2)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Profit/min</span>
            <span className="stat-value">{stats.currentMap.incomePerMinute.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <h3>Total</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Maps</span>
            <span className="stat-value">{stats.total.mapCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Duration</span>
            <span className="stat-value">{formatDuration(stats.total.duration)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Profit</span>
            <span className="stat-value highlight">{stats.total.feIncome.toFixed(2)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Profit/min</span>
            <span className="stat-value">{stats.total.incomePerMinute.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsCard;

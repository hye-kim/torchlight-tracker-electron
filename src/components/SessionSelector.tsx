import React, { useState, useMemo } from 'react';
import './SessionSelector.css';

interface Session {
  sessionId: string;
  title: string;
  startTime: number;
  endTime?: number;
  duration: number;
  stats: {
    totalProfit: number;
    totalRevenue: number;
    totalCost: number;
    mapsCompleted: number;
    profitPerMinute: number;
    profitPerHour: number;
  };
  mapLogs: unknown[];
  isActive: boolean;
  lastModified: number;
}

interface SessionSelectorProps {
  sessions: Session[];
  selectedSessionIds: string[];
  onSelectionChange: (sessionIds: string[]) => void;
  onDelete: (sessionIds: string[]) => void;
}

const SessionSelector: React.FC<SessionSelectorProps> = ({
  sessions,
  selectedSessionIds,
  onSelectionChange,
  onDelete,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleToggleSession = (sessionId: string): void => {
    if (selectedSessionIds.includes(sessionId)) {
      onSelectionChange(selectedSessionIds.filter((id) => id !== sessionId));
    } else {
      onSelectionChange([...selectedSessionIds, sessionId]);
    }
  };

  const handleSelectAll = (): void => {
    onSelectionChange(sessions.map((s) => s.sessionId));
  };

  const handleClearAll = (): void => {
    onSelectionChange([]);
  };

  const handleDelete = (): void => {
    // Filter out active sessions from deletion
    const sessionsToDelete = selectedSessionIds.filter((id) => {
      const session = sessions.find((s) => s.sessionId === id);
      return session && !session.isActive;
    });

    if (sessionsToDelete.length === 0) {
      alert('Cannot delete active sessions');
      return;
    }

    onDelete(sessionsToDelete);
    setShowDeleteConfirm(false);
  };

  const formatProfit = (profit: number): string => {
    const sign = profit >= 0 ? '+' : '';
    return `${sign}${Math.floor(profit).toLocaleString()} FE`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day} ${year}`;
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Sort sessions by start time (newest first)
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.startTime - a.startTime),
    [sessions]
  );

  const selectedNonActiveSessions = useMemo(
    () =>
      selectedSessionIds.filter((id) => {
        const session = sessions.find((s) => s.sessionId === id);
        return session && !session.isActive;
      }),
    [selectedSessionIds, sessions]
  );

  return (
    <div className="session-selector">
      <div className="session-selector-header">
        <h2>Sessions</h2>
        <div className="session-selector-controls">
          <button
            className="session-control-btn"
            onClick={handleSelectAll}
            disabled={sessions.length === 0}
          >
            Select All
          </button>
          <button
            className="session-control-btn"
            onClick={handleClearAll}
            disabled={selectedSessionIds.length === 0}
          >
            Clear All
          </button>
          <button
            className="session-control-btn delete-btn"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={selectedNonActiveSessions.length === 0}
          >
            Delete Selected
          </button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="session-empty-state">
          <p>No sessions found. Start playing to create your first session!</p>
        </div>
      ) : (
        <div className="session-grid">
          {sortedSessions.map((session) => (
            <div
              key={session.sessionId}
              className={`session-box ${selectedSessionIds.includes(session.sessionId) ? 'selected' : ''} ${session.isActive ? 'active' : ''}`}
              onClick={() => handleToggleSession(session.sessionId)}
            >
              <div className="session-box-row">
                <div className="session-date-time">
                  <span className="session-date">{formatDate(session.startTime)}</span>
                  <span className="session-time">{formatTime(session.startTime)}</span>
                </div>
                {session.isActive && <span className="session-active-badge">Active</span>}
              </div>
              <div className="session-box-row session-stats-row">
                <span className="session-stat">{formatDuration(session.duration)}</span>
                <span className="session-stat">{session.stats.mapsCompleted} maps</span>
                <span
                  className={`session-stat ${session.stats.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}
                >
                  {formatProfit(session.stats.totalProfit)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="delete-confirm-modal">
          <div className="delete-confirm-content">
            <h3>Confirm Delete</h3>
            <p>
              Are you sure you want to delete {selectedNonActiveSessions.length} session(s)?
              <br />
              This action cannot be undone.
            </p>
            <div className="delete-confirm-buttons">
              <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="delete-confirm-btn" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SessionSelector);

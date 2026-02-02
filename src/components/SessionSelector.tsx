import React, { useState } from 'react';
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
  mapLogs: any[];
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

  const handleToggleSession = (sessionId: string) => {
    if (selectedSessionIds.includes(sessionId)) {
      onSelectionChange(selectedSessionIds.filter(id => id !== sessionId));
    } else {
      onSelectionChange([...selectedSessionIds, sessionId]);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(sessions.map(s => s.sessionId));
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const handleDelete = () => {
    // Filter out active sessions from deletion
    const sessionsToDelete = selectedSessionIds.filter(id => {
      const session = sessions.find(s => s.sessionId === id);
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

  // Sort sessions by start time (newest first)
  const sortedSessions = [...sessions].sort((a, b) => b.startTime - a.startTime);

  const selectedNonActiveSessions = selectedSessionIds.filter(id => {
    const session = sessions.find(s => s.sessionId === id);
    return session && !session.isActive;
  });

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
        <div className="session-list">
          {sortedSessions.map(session => (
            <div
              key={session.sessionId}
              className={`session-item ${selectedSessionIds.includes(session.sessionId) ? 'selected' : ''}`}
              onClick={() => handleToggleSession(session.sessionId)}
            >
              <input
                type="checkbox"
                checked={selectedSessionIds.includes(session.sessionId)}
                onChange={() => handleToggleSession(session.sessionId)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="session-item-content">
                <div className="session-item-title">
                  {session.title}
                  {session.isActive && <span className="session-active-badge">Active</span>}
                </div>
                <div className="session-item-stats">
                  <span>{session.stats.mapsCompleted} maps</span>
                  <span className={session.stats.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}>
                    {formatProfit(session.stats.totalProfit)}
                  </span>
                </div>
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

export default SessionSelector;

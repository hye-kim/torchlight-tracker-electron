import { useState } from 'react';
import './MapLogTable.css';

interface MapLog {
  mapNumber: number;
  mapName: string;
  startTime: number;
  revenue: number;
  cost: number;
  profit: number;
  duration: number;
  sessionId?: string;
}

interface CurrentMapData {
  mapNumber: number;
  mapName: string;
  startTime: number;
  revenue: number;
  cost: number;
  profit: number;
  duration: number;
}

interface MapLogTableProps {
  mapLogs: MapLog[];
  isInitialized: boolean;
  isInMap: boolean;
  currentMap: CurrentMapData | null;
  mapCount: number;
  selectedMapNumber: number | null;
  selectedSessionId?: string | null;
  onSelectMap: (mapNumber: number | null, sessionId?: string | null) => void;
}

type SortColumn = 'mapNumber' | 'revenue' | 'cost' | 'profit' | 'duration';
type SortDirection = 'asc' | 'desc';

function MapLogTable({
  mapLogs,
  isInitialized,
  isInMap,
  currentMap,
  mapCount,
  selectedMapNumber,
  selectedSessionId,
  onSelectMap,
}: MapLogTableProps): JSX.Element {
  const [sortColumn, setSortColumn] = useState<SortColumn>('mapNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (column: SortColumn): void => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const sortedLogs = [...mapLogs].sort((a, b) => {
    let comparison = 0;

    switch (sortColumn) {
      case 'mapNumber':
        comparison = a.mapNumber - b.mapNumber;
        break;
      case 'revenue':
        comparison = a.revenue - b.revenue;
        break;
      case 'cost':
        comparison = a.cost - b.cost;
        break;
      case 'profit':
        comparison = a.profit - b.profit;
        break;
      case 'duration':
        comparison = a.duration - b.duration;
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const getSortIcon = (column: SortColumn): string => {
    if (sortColumn !== column) return '▼';
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  // Create display list with current map at top if active
  // Filter out current map from sorted logs to prevent duplication
  const displayLogs: Array<MapLog & { isActive?: boolean }> =
    isInMap && currentMap
      ? [
          { ...currentMap, isActive: true },
          ...sortedLogs.filter((log) => log.mapNumber !== currentMap.mapNumber),
        ]
      : sortedLogs;

  const handleRowClick = (mapNumber: number, sessionId?: string): void => {
    onSelectMap(mapNumber, sessionId);
  };

  return (
    <div className="map-log-table-container">
      <div className="map-log-header">
        <div className="map-log-title">
          <h2>Map Log</h2>
          <span className="map-count">{mapCount}</span>
        </div>
        <div className={`status-indicator ${isInitialized ? 'recording' : 'not-recording'}`}>
          <span className="status-dot"></span>
          <span className="status-text">{isInitialized ? 'Recording' : 'Not Recording'}</span>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="map-log-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('mapNumber')} className="sortable col-map">
                MAP / TIME {getSortIcon('mapNumber')}
              </th>
              <th onClick={() => handleSort('revenue')} className="sortable col-number">
                PICKED UP {getSortIcon('revenue')}
              </th>
              <th onClick={() => handleSort('cost')} className="sortable col-number">
                COST {getSortIcon('cost')}
              </th>
              <th onClick={() => handleSort('profit')} className="sortable col-number">
                PROFIT {getSortIcon('profit')}
              </th>
              <th onClick={() => handleSort('duration')} className="sortable col-duration">
                DURATION {getSortIcon('duration')}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="no-maps">
                  No maps completed yet
                </td>
              </tr>
            ) : (
              displayLogs.map((log) => {
                const isActive = log.isActive ?? false;
                const isSelected =
                  selectedMapNumber === log.mapNumber &&
                  (selectedSessionId === log.sessionId ||
                    selectedSessionId === null ||
                    selectedSessionId === undefined);

                return (
                  <tr
                    key={isActive ? 'current' : `${log.sessionId}-${log.mapNumber}`}
                    className={`${isActive ? 'active-row' : ''} ${isSelected ? 'selected-row' : ''}`}
                    onClick={() => handleRowClick(log.mapNumber, log.sessionId)}
                  >
                    <td className="map-cell">
                      {isActive && <span className="active-indicator"></span>}
                      <div className="map-info">
                        <div className="map-name">{log.mapName || `Map ${log.mapNumber}`}</div>
                        <div className="map-time">{formatTimestamp(log.startTime)}</div>
                      </div>
                    </td>
                    <td className="number-cell">{log.revenue.toFixed(2)}</td>
                    <td className="number-cell cost">{(-log.cost).toFixed(2)}</td>
                    <td className={`number-cell ${log.profit >= 0 ? 'positive' : 'negative'}`}>
                      {log.profit.toFixed(2)}
                    </td>
                    <td className="duration-cell">{formatDuration(log.duration)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MapLogTable;

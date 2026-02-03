import React, { useState, useEffect } from 'react';
import './HistoryView.css';
import SessionSelector from './SessionSelector';
import HistoryStatsPanel from './HistoryStatsPanel';
import MapLogTable from './MapLogTable';
import DropsCard from './DropsCard';

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

interface Drop {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  type: string;
  timestamp: number;
  imageUrl?: string;
}

const HistoryView: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [selectedMapNumber, setSelectedMapNumber] = useState<number | null>(null);
  const [profitMode, setProfitMode] = useState<'perMinute' | 'perHour'>('perMinute');

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const allSessions = await window.electronAPI.getSessions();
    setSessions(allSessions);

    // Auto-select current active session if exists
    const activeSession = allSessions.find((s: Session) => s.isActive);
    if (activeSession) {
      setSelectedSessionIds([activeSession.sessionId]);
    }
  };

  // Calculate aggregated stats from selected sessions
  const aggregatedStats = React.useMemo(() => {
    const selectedSessions = sessions.filter(s =>
      selectedSessionIds.includes(s.sessionId)
    );

    if (selectedSessions.length === 0) {
      return {
        totalProfit: 0,
        totalRevenue: 0,
        totalCost: 0,
        mapsCompleted: 0,
        duration: 0,
        profitPerMinute: 0,
        profitPerHour: 0,
      };
    }

    const totalProfit = selectedSessions.reduce((sum, s) => sum + s.stats.totalProfit, 0);
    const totalRevenue = selectedSessions.reduce((sum, s) => sum + s.stats.totalRevenue, 0);
    const totalCost = selectedSessions.reduce((sum, s) => sum + s.stats.totalCost, 0);
    const mapsCompleted = selectedSessions.reduce((sum, s) => sum + s.stats.mapsCompleted, 0);
    const totalDuration = selectedSessions.reduce((sum, s) => sum + s.duration, 0);

    return {
      totalProfit,
      totalRevenue,
      totalCost,
      mapsCompleted,
      duration: totalDuration,
      profitPerMinute: totalDuration > 0 ? totalProfit / (totalDuration / 60) : 0,
      profitPerHour: totalDuration > 0 ? totalProfit / (totalDuration / 3600) : 0,
    };
  }, [sessions, selectedSessionIds]);

  // Get combined map logs from selected sessions
  const combinedMapLogs = React.useMemo(() => {
    const selectedSessions = sessions.filter(s =>
      selectedSessionIds.includes(s.sessionId)
    );

    const allLogs: any[] = [];
    selectedSessions.forEach(session => {
      session.mapLogs.forEach(mapLog => {
        allLogs.push({
          ...mapLog,
          sessionId: session.sessionId,
          sessionTitle: session.title,
        });
      });
    });

    // Sort by start time descending (newest first)
    return allLogs.sort((a, b) => b.startTime - a.startTime);
  }, [sessions, selectedSessionIds]);

  // Get drops for selected map or all maps
  const drops: Drop[] = React.useMemo(() => {
    if (selectedMapNumber !== null) {
      // Find the specific map
      const selectedMap = combinedMapLogs.find(m => m.mapNumber === selectedMapNumber);
      if (selectedMap && selectedMap.drops) {
        // Data is already enriched by backend
        return selectedMap.drops;
      }
      return [];
    } else {
      // Aggregate all drops from all maps in selected sessions
      const aggregatedDrops = new Map<string, Drop>();
      combinedMapLogs.forEach(mapLog => {
        if (mapLog.drops) {
          mapLog.drops.forEach((drop: Drop) => {
            const existing = aggregatedDrops.get(drop.itemId);
            if (existing) {
              // Update quantity while keeping other enriched data
              existing.quantity += drop.quantity;
            } else {
              // Clone the drop to avoid mutating original data
              aggregatedDrops.set(drop.itemId, { ...drop });
            }
          });
        }
      });

      return Array.from(aggregatedDrops.values());
    }
  }, [combinedMapLogs, selectedMapNumber]);

  // Get costs for selected map or all maps
  const costs: Drop[] = React.useMemo(() => {
    if (selectedMapNumber !== null) {
      const selectedMap = combinedMapLogs.find(m => m.mapNumber === selectedMapNumber);
      if (selectedMap && selectedMap.costs) {
        // Data is already enriched by backend
        return selectedMap.costs;
      }
      return [];
    } else {
      const aggregatedCosts = new Map<string, Drop>();
      combinedMapLogs.forEach(mapLog => {
        if (mapLog.costs) {
          mapLog.costs.forEach((cost: Drop) => {
            const existing = aggregatedCosts.get(cost.itemId);
            if (existing) {
              // Update quantity while keeping other enriched data
              existing.quantity += cost.quantity;
            } else {
              // Clone the cost to avoid mutating original data
              aggregatedCosts.set(cost.itemId, { ...cost });
            }
          });
        }
      });

      return Array.from(aggregatedCosts.values());
    }
  }, [combinedMapLogs, selectedMapNumber]);

  // Calculate total picked up and total cost
  const totalPickedUp = React.useMemo(() => {
    return drops.reduce((sum, drop) => sum + drop.price * drop.quantity, 0);
  }, [drops]);

  const totalCost = React.useMemo(() => {
    return costs.reduce((sum, cost) => sum + cost.price * cost.quantity, 0);
  }, [costs]);

  const handleDeleteSessions = async (sessionIds: string[]) => {
    await window.electronAPI.deleteSessions(sessionIds);
    loadSessions();
    setSelectedSessionIds([]);
  };

  return (
    <div className="history-view">
      <div className="history-content">
        <SessionSelector
          sessions={sessions}
          selectedSessionIds={selectedSessionIds}
          onSelectionChange={setSelectedSessionIds}
          onDelete={handleDeleteSessions}
        />

        <HistoryStatsPanel
          stats={aggregatedStats}
          profitMode={profitMode}
          onProfitModeToggle={() =>
            setProfitMode(profitMode === 'perMinute' ? 'perHour' : 'perMinute')
          }
        />

        <div className="history-tables">
          <div className="history-map-log">
            <MapLogTable
              mapLogs={combinedMapLogs}
              isInitialized={true}
              isInMap={false}
              currentMap={null}
              mapCount={combinedMapLogs.length}
              selectedMapNumber={selectedMapNumber}
              onSelectMap={setSelectedMapNumber}
            />
          </div>

          <div className="history-loot-summary">
            <DropsCard
              drops={drops}
              costs={costs}
              totalPickedUp={totalPickedUp}
              totalCost={totalCost}
              selectedMapName={selectedMapNumber !== null ? `Map #${selectedMapNumber}` : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryView;

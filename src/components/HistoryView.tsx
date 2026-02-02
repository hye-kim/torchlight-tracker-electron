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
        // Convert to Drop format (we'll need item data)
        return selectedMap.drops.map((drop: any) => ({
          itemId: drop.itemId,
          name: drop.itemId, // Will be enriched with actual name
          quantity: drop.quantity,
          price: 0, // Will be enriched
          type: 'Unknown',
          timestamp: selectedMap.startTime,
        }));
      }
      return [];
    } else {
      // Aggregate all drops from all maps in selected sessions
      const aggregatedDrops = new Map<string, number>();
      combinedMapLogs.forEach(mapLog => {
        if (mapLog.drops) {
          mapLog.drops.forEach((drop: any) => {
            const current = aggregatedDrops.get(drop.itemId) || 0;
            aggregatedDrops.set(drop.itemId, current + drop.quantity);
          });
        }
      });

      return Array.from(aggregatedDrops.entries()).map(([itemId, quantity]) => ({
        itemId,
        name: itemId,
        quantity,
        price: 0,
        type: 'Unknown',
        timestamp: Date.now(),
      }));
    }
  }, [combinedMapLogs, selectedMapNumber]);

  // Get costs for selected map or all maps
  const costs: Drop[] = React.useMemo(() => {
    if (selectedMapNumber !== null) {
      const selectedMap = combinedMapLogs.find(m => m.mapNumber === selectedMapNumber);
      if (selectedMap && selectedMap.costs) {
        return selectedMap.costs.map((cost: any) => ({
          itemId: cost.itemId,
          name: cost.itemId,
          quantity: cost.quantity,
          price: 0,
          type: 'Unknown',
          timestamp: selectedMap.startTime,
        }));
      }
      return [];
    } else {
      const aggregatedCosts = new Map<string, number>();
      combinedMapLogs.forEach(mapLog => {
        if (mapLog.costs) {
          mapLog.costs.forEach((cost: any) => {
            const current = aggregatedCosts.get(cost.itemId) || 0;
            aggregatedCosts.set(cost.itemId, current + cost.quantity);
          });
        }
      });

      return Array.from(aggregatedCosts.entries()).map(([itemId, quantity]) => ({
        itemId,
        name: itemId,
        quantity,
        price: 0,
        type: 'Unknown',
        timestamp: Date.now(),
      }));
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

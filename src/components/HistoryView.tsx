import React, { useState, useEffect, useCallback } from 'react';
import './HistoryView.css';
import SessionSelector from './SessionSelector';
import HistoryStatsPanel from './HistoryStatsPanel';
import MapLogTable from './MapLogTable';
import DropsCard from './DropsCard';
import { useStatsStore } from '../stores';

interface HistorySession {
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
  mapLogs: MapLog[];
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

interface MapItemData {
  itemId: string;
  quantity: number;
  price: number;
  name?: string;
  type?: string;
  imageUrl?: string;
}

interface MapLog {
  mapNumber: number;
  mapName: string;
  startTime: number;
  revenue: number;
  cost: number;
  profit: number;
  duration: number;
  drops?: MapItemData[];
  costs?: MapItemData[];
  sessionId?: string;
  sessionTitle?: string;
}

const HistoryView: React.FC = () => {
  const { drops: globalDrops, costs: globalCosts } = useStatsStore();
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [selectedMapNumber, setSelectedMapNumber] = useState<number | null>(null);
  const [selectedMapSessionId, setSelectedMapSessionId] = useState<string | null>(null);
  const [profitMode, setProfitMode] = useState<'perMinute' | 'perHour'>('perMinute');

  const loadSessions = async (): Promise<void> => {
    const allSessions = await window.electronAPI.getSessions();
    setSessions(allSessions as unknown as HistorySession[]);

    // Auto-select current active session if exists
    const activeSession = allSessions.find((s) => (s as unknown as HistorySession).isActive);
    if (activeSession) {
      setSelectedSessionIds([(activeSession as unknown as HistorySession).sessionId]);
    }
  };

  // Load sessions on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions();
  }, []);

  // Calculate aggregated stats from selected sessions
  const aggregatedStats = React.useMemo(() => {
    const selectedSessions = sessions.filter((s) => selectedSessionIds.includes(s.sessionId));

    if (selectedSessions.length === 0) {
      return {
        totalProfit: 0,
        totalRevenue: 0,
        totalCost: 0,
        mapsCompleted: 0,
        duration: 0,
        mapDuration: 0,
        profitPerMinute: 0,
        profitPerHour: 0,
        mapProfitPerMinute: 0,
        mapProfitPerHour: 0,
      };
    }

    const totalProfit = selectedSessions.reduce((sum, s) => sum + s.stats.totalProfit, 0);
    const totalRevenue = selectedSessions.reduce((sum, s) => sum + s.stats.totalRevenue, 0);
    const totalCost = selectedSessions.reduce((sum, s) => sum + s.stats.totalCost, 0);
    const mapsCompleted = selectedSessions.reduce((sum, s) => sum + s.stats.mapsCompleted, 0);
    const totalDuration = selectedSessions.reduce((sum, s) => sum + s.duration, 0);

    // Calculate average map duration from actual map durations
    let totalMapDuration = 0;
    selectedSessions.forEach((session) => {
      session.mapLogs.forEach((mapLog) => {
        totalMapDuration += mapLog.duration;
      });
    });
    const avgMapDuration = mapsCompleted > 0 ? totalMapDuration / mapsCompleted : 0;

    return {
      totalProfit,
      totalRevenue,
      totalCost,
      mapsCompleted,
      duration: totalDuration,
      mapDuration: avgMapDuration,
      profitPerMinute: totalDuration > 0 ? totalProfit / (totalDuration / 60) : 0,
      profitPerHour: totalDuration > 0 ? totalProfit / (totalDuration / 3600) : 0,
      mapProfitPerMinute:
        avgMapDuration > 0 ? totalProfit / mapsCompleted / (avgMapDuration / 60) : 0,
      mapProfitPerHour:
        avgMapDuration > 0 ? totalProfit / mapsCompleted / (avgMapDuration / 3600) : 0,
    };
  }, [sessions, selectedSessionIds]);

  // Get combined map logs from selected sessions
  const combinedMapLogs = React.useMemo(() => {
    const selectedSessions = sessions.filter((s) => selectedSessionIds.includes(s.sessionId));

    const allLogs: MapLog[] = [];
    selectedSessions.forEach((session) => {
      session.mapLogs.forEach((mapLog) => {
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

  // Find the selected map from combined logs
  const selectedMapData = React.useMemo(() => {
    if (selectedMapNumber === null || selectedMapSessionId === null) return null;
    return (
      combinedMapLogs.find(
        (m) => m.mapNumber === selectedMapNumber && m.sessionId === selectedMapSessionId
      ) ?? null
    );
  }, [combinedMapLogs, selectedMapNumber, selectedMapSessionId]);

  // Get drops for the selected map, enriched with item metadata.
  // Prefer metadata from the session data (populated by getSessions backend handler),
  // falling back to globalDrops only when session data lacks enrichment.
  const drops: Drop[] = React.useMemo(() => {
    if (!selectedMapData?.drops) return [];

    return selectedMapData.drops.map((item: MapItemData) => {
      const existingDrop = globalDrops.find((d) => d.itemId === item.itemId);
      return {
        itemId: item.itemId,
        name: item.name ?? existingDrop?.name ?? `Item ${item.itemId}`,
        quantity: item.quantity,
        price: item.price,
        type: item.type ?? existingDrop?.type ?? 'Unknown',
        timestamp: selectedMapData.startTime,
        imageUrl: item.imageUrl ?? existingDrop?.imageUrl,
      };
    });
  }, [selectedMapData, globalDrops]);

  // Get costs for the selected map, enriched with item metadata.
  // Prefer metadata from the session data, falling back to globalCosts/globalDrops.
  const costs: Drop[] = React.useMemo(() => {
    if (!selectedMapData?.costs) return [];

    return selectedMapData.costs.map((item: MapItemData) => {
      const existingCost = globalCosts.find((c) => c.itemId === item.itemId);
      const existingDrop = globalDrops.find((d) => d.itemId === item.itemId);
      return {
        itemId: item.itemId,
        name: item.name ?? existingCost?.name ?? existingDrop?.name ?? `Item ${item.itemId}`,
        quantity: item.quantity,
        price: item.price,
        type: item.type ?? existingCost?.type ?? existingDrop?.type ?? 'Unknown',
        timestamp: selectedMapData.startTime,
        imageUrl: item.imageUrl ?? existingCost?.imageUrl ?? existingDrop?.imageUrl,
      };
    });
  }, [selectedMapData, globalDrops, globalCosts]);

  // Calculate total picked up and total cost
  const totalPickedUp = React.useMemo(() => {
    return drops.reduce((sum, drop) => sum + drop.price * drop.quantity, 0);
  }, [drops]);

  const totalCost = React.useMemo(() => {
    return costs.reduce((sum, cost) => sum + cost.price * cost.quantity, 0);
  }, [costs]);

  // Reset selected map when sessions change or become unselected
  useEffect(() => {
    if (selectedMapNumber !== null && selectedMapSessionId !== null) {
      const mapExists = combinedMapLogs.some(
        (m) => m.mapNumber === selectedMapNumber && m.sessionId === selectedMapSessionId
      );
      if (!mapExists) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedMapNumber(null);
        setSelectedMapSessionId(null);
      }
    }
  }, [combinedMapLogs, selectedMapNumber, selectedMapSessionId]);

  const selectedMapName = React.useMemo(() => {
    if (selectedMapNumber === null || selectedMapSessionId === null) return undefined;
    const selectedMap = combinedMapLogs.find(
      (m) => m.mapNumber === selectedMapNumber && m.sessionId === selectedMapSessionId
    );
    return selectedMap
      ? `${selectedMap.mapName ?? `Map #${selectedMap.mapNumber}`} (${selectedMap.sessionTitle ?? 'Session'})`
      : `Map #${selectedMapNumber}`;
  }, [selectedMapNumber, selectedMapSessionId, combinedMapLogs]);

  const handleDeleteSessions = useCallback((sessionIds: string[]): void => {
    void window.electronAPI.deleteSessions(sessionIds).then(() => {
      void loadSessions();
      setSelectedSessionIds([]);
    });
  }, []);

  const handleProfitModeToggle = useCallback(() => {
    setProfitMode((prev) => (prev === 'perMinute' ? 'perHour' : 'perMinute'));
  }, []);

  const handleSelectMap = useCallback((mapNumber: number | null, sessionId?: string | null) => {
    setSelectedMapNumber(mapNumber);
    setSelectedMapSessionId(sessionId ?? null);
  }, []);

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
          onProfitModeToggle={handleProfitModeToggle}
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
              selectedSessionId={selectedMapSessionId}
              onSelectMap={handleSelectMap}
            />
          </div>

          <div className="history-loot-summary">
            <DropsCard
              drops={drops}
              costs={costs}
              totalPickedUp={totalPickedUp}
              totalCost={totalCost}
              selectedMapName={selectedMapName}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryView;

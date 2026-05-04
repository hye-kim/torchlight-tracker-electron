import React, { useCallback, useState } from 'react';
import StatsBar from '../components/StatsBar';
import ControlsBar from '../components/ControlsBar';
import MapLogTable from '../components/MapLogTable';
import DropsCard from '../components/DropsCard';
import { useStatsStore, useMapStore, useInitStore } from '../stores';
import { useInitialization, useMapSelection } from '../hooks';

interface OverviewPageProps {
  onOpenSettings: () => void;
  onToggleOverlay: () => Promise<void>;
  onExportExcel: () => Promise<void>;
  onResetStats: () => Promise<void>;
  isExporting?: boolean;
}

const OverviewPage: React.FC<OverviewPageProps> = ({
  onOpenSettings,
  onToggleOverlay,
  onExportExcel,
  onResetStats,
  isExporting = false,
}) => {
  const { stats, mapLogs } = useStatsStore();
  const { currentMap, isInMap } = useMapStore();
  const { isInitialized, isWaitingForInit } = useInitStore();
  const { handleInitializeTracker } = useInitialization();
  const [profitMode, setProfitMode] = useState<'perMinute' | 'perHour'>('perMinute');
  const handleProfitModeToggle = useCallback(() => {
    setProfitMode((prev) => (prev === 'perMinute' ? 'perHour' : 'perMinute'));
  }, []);
  const handleDeleteMap = useCallback((mapNumber: number): void => {
    void window.electronAPI.deleteMap(mapNumber);
  }, []);
  const {
    selectedMapData,
    selectedMapDrops,
    selectedMapCosts,
    totalPickedUp,
    totalCost,
    setSelectedMapNumber,
  } = useMapSelection(true); // Use current prices in Overview

  return (
    <>
      <div className="center-panel">
        <ControlsBar
          onInitialize={handleInitializeTracker}
          onExportExcel={onExportExcel}
          onOpenSettings={onOpenSettings}
          onResetStats={onResetStats}
          onToggleOverlay={onToggleOverlay}
          isInitialized={isInitialized}
          isWaitingForInit={isWaitingForInit}
          isExporting={isExporting}
        />
        <StatsBar
          stats={stats}
          profitMode={profitMode}
          onProfitModeToggle={handleProfitModeToggle}
        />
        <MapLogTable
          mapLogs={mapLogs}
          isInitialized={isInitialized}
          isInMap={isInMap}
          currentMap={currentMap}
          mapCount={stats?.total.mapCount ?? 0}
          selectedMapNumber={selectedMapData ? selectedMapData.mapNumber : null}
          onSelectMap={setSelectedMapNumber}
          onDeleteMap={handleDeleteMap}
        />
      </div>

      <div className="right-panel">
        <DropsCard
          drops={selectedMapDrops}
          costs={selectedMapCosts}
          totalPickedUp={totalPickedUp}
          totalCost={totalCost}
          selectedMapName={selectedMapData?.mapName}
        />
      </div>
    </>
  );
};

export default OverviewPage;

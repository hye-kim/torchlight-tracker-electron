import React from 'react';
import StatsBar from '../components/StatsBar';
import ControlsBar from '../components/ControlsBar';
import MapLogTable from '../components/MapLogTable';
import DropsCard from '../components/DropsCard';
import { useStatsStore, useMapStore, useInitStore } from '../stores';
import { useInitialization, useMapSelection } from '../hooks';

interface OverviewPageProps {
  onOpenSettings: () => void;
  onToggleOverlay: () => void;
  onExportExcel: () => Promise<void>;
  onResetStats: () => Promise<void>;
}

const OverviewPage: React.FC<OverviewPageProps> = ({
  onOpenSettings,
  onToggleOverlay,
  onExportExcel,
  onResetStats,
}) => {
  const { stats, mapLogs } = useStatsStore();
  const { currentMap, isInMap } = useMapStore();
  const { isInitialized, isWaitingForInit } = useInitStore();
  const { handleInitializeTracker } = useInitialization();
  const {
    selectedMapData,
    selectedMapDrops,
    selectedMapCosts,
    totalPickedUp,
    totalCost,
    setSelectedMapNumber,
  } = useMapSelection();

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
        />
        <StatsBar stats={stats} />
        <MapLogTable
          mapLogs={mapLogs}
          isInitialized={isInitialized}
          isInMap={isInMap}
          currentMap={currentMap}
          mapCount={stats?.total.mapCount ?? 0}
          selectedMapNumber={selectedMapData ? selectedMapData.mapNumber : null}
          onSelectMap={setSelectedMapNumber}
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

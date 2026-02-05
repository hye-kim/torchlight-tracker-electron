import { useEffect } from 'react';
import {
  useConfigStore,
  useStatsStore,
  useMapStore,
  useInventoryStore,
  useInitStore,
  useUpdateStore,
} from '../stores';

/**
 * Custom hook to load initial data from Electron API and listen for updates
 */
export const useElectronData = () => {
  const { setConfig, updateConfig } = useConfigStore();
  const { setStats, setDrops, setCosts, setMapLogs } = useStatsStore();
  const { setCurrentMap, setIsInMap } = useMapStore();
  const { setBagInventory } = useInventoryStore();
  const { setIsInitialized } = useInitStore();
  const { setUpdateInfo, setShowUpdateNotification } = useUpdateStore();

  useEffect(() => {
    // Load initial data
    const loadInitialData = async () => {
      const [config, stats, drops, mapLogs, bagState] = await Promise.all([
        window.electronAPI.getConfig(),
        window.electronAPI.getStats(),
        window.electronAPI.getDrops(),
        window.electronAPI.getMapLogs?.() ?? Promise.resolve(null),
        window.electronAPI.getBagState?.() ?? Promise.resolve(null),
      ]);

      setConfig(config);
      setStats(stats);
      setDrops(drops);
      if (mapLogs) setMapLogs(mapLogs);
      if (bagState) setBagInventory(bagState);
    };

    loadInitialData();

    // Listen for display updates
    window.electronAPI.onUpdateDisplay((data: any) => {
      if (data.stats) setStats(data.stats);
      if (data.drops) setDrops(data.drops);
      if (data.costs) setCosts(data.costs);
      if (data.mapLogs) setMapLogs(data.mapLogs);
      if (data.bagInventory) setBagInventory(data.bagInventory);
      if (data.isInMap !== undefined) setIsInMap(data.isInMap);
      if (data.currentMap) setCurrentMap(data.currentMap);
      if (data.isInitialized !== undefined) setIsInitialized(data.isInitialized);
    });

    // Listen for overlay mode changes
    window.electronAPI.onOverlayModeChanged((overlayMode: boolean) => {
      updateConfig({ overlayMode });
    });

    // Listen for update events
    window.electronAPI.onUpdateAvailable((info: any) => {
      setUpdateInfo(info);
      setShowUpdateNotification(true);
    });

    window.electronAPI.onUpdateNotAvailable(() => {
      // Update not available - no action needed
    });

    window.electronAPI.onUpdateError((error: any) => {
      console.error('Update error:', error);
    });
  }, [
    setConfig,
    setStats,
    setDrops,
    setCosts,
    setMapLogs,
    setBagInventory,
    setIsInMap,
    setCurrentMap,
    setIsInitialized,
    updateConfig,
    setUpdateInfo,
    setShowUpdateNotification,
  ]);
};

import { useEffect } from 'react';
import {
  useConfigStore,
  useStatsStore,
  useMapStore,
  useInventoryStore,
  useUpdateStore,
} from '../stores';

/**
 * Custom hook to load initial data from Electron API and listen for updates
 */
export const useElectronData = (): void => {
  const { setConfig, updateConfig } = useConfigStore();
  const { setStats, setDrops, setCosts, setMapLogs } = useStatsStore();
  const { setCurrentMap, setIsInMap } = useMapStore();
  const { setBagInventory } = useInventoryStore();
  const { setUpdateInfo, setShowUpdateNotification } = useUpdateStore();

  useEffect(() => {
    // Load initial data
    const loadInitialData = async (): Promise<void> => {
      const [config, stats, drops, mapLogs, bagInventory] = await Promise.all([
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
      if (bagInventory && Array.isArray(bagInventory)) setBagInventory(bagInventory);
    };

    void loadInitialData();

    // Listen for display updates
    window.electronAPI.onUpdateDisplay((data) => {
      if (data.stats) setStats(data.stats);
      if (data.drops) setDrops(data.drops);
      if (data.costs) setCosts(data.costs);
      if (data.mapLogs) setMapLogs(data.mapLogs);
      if (data.currentMap !== undefined) setCurrentMap(data.currentMap);
      if (data.isInMap !== undefined) setIsInMap(data.isInMap);
      if (data.bagInventory && Array.isArray(data.bagInventory)) {
        setBagInventory(data.bagInventory);
      }
    });

    // Listen for overlay mode changes
    window.electronAPI.onOverlayModeChanged((overlayMode: boolean) => {
      updateConfig({ overlayMode });
    });

    // Listen for update events
    window.electronAPI.onUpdateAvailable((info) => {
      setUpdateInfo(info);
      setShowUpdateNotification(true);
    });

    window.electronAPI.onUpdateNotAvailable(() => {
      // Update not available - no action needed
    });

    window.electronAPI.onUpdateError((error) => {
      console.error('Update error:', error);
    });
  }, [
    setConfig,
    setStats,
    setDrops,
    setCosts,
    setMapLogs,
    setCurrentMap,
    setIsInMap,
    setBagInventory,
    updateConfig,
    setUpdateInfo,
    setShowUpdateNotification,
  ]);
};

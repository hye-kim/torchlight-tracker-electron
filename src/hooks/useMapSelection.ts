import { useEffect, useMemo } from 'react';
import { useStatsStore, useMapStore } from '../stores';
import { Drop, MapItemData } from '../types';

/**
 * Custom hook to handle map selection and retrieve map data
 */
export const useMapSelection = () => {
  const { drops, costs, mapLogs } = useStatsStore();
  const { currentMap, isInMap, selectedMapNumber, setSelectedMapNumber } = useMapStore();

  // Auto-select current map when in map
  useEffect(() => {
    if (isInMap && currentMap) {
      setSelectedMapNumber(currentMap.mapNumber);
    }
  }, [isInMap, currentMap, setSelectedMapNumber]);

  // Get the selected map data (current map or from map logs)
  const selectedMapData = useMemo(() => {
    if (selectedMapNumber === null) return null;

    // If currently in map and selected the current map
    if (isInMap && currentMap && selectedMapNumber === currentMap.mapNumber) {
      return currentMap;
    }

    // Otherwise find in map logs
    return mapLogs.find((log) => log.mapNumber === selectedMapNumber) || null;
  }, [selectedMapNumber, mapLogs, isInMap, currentMap]);

  // Get drops for the selected map
  const selectedMapDrops = useMemo(() => {
    if (!selectedMapData || !selectedMapData.drops) return [];

    return selectedMapData.drops.map((item: MapItemData) => {
      const existingDrop = drops.find((d) => d.itemId === item.itemId);
      return {
        itemId: item.itemId,
        name: existingDrop?.name || `Item ${item.itemId}`,
        quantity: item.quantity,
        price: existingDrop?.price ?? 0,
        type: existingDrop?.type || 'Unknown',
        timestamp: selectedMapData.startTime,
        imageUrl: existingDrop?.imageUrl,
      };
    });
  }, [selectedMapData, drops]);

  // Get costs for the selected map
  const selectedMapCosts = useMemo(() => {
    if (!selectedMapData || !selectedMapData.costs) return [];

    return selectedMapData.costs.map((item: MapItemData) => {
      const existingCost = costs.find((c) => c.itemId === item.itemId);
      const existingDrop = drops.find((d) => d.itemId === item.itemId);
      return {
        itemId: item.itemId,
        name: existingCost?.name || existingDrop?.name || `Item ${item.itemId}`,
        quantity: item.quantity,
        price: existingCost?.price ?? existingDrop?.price ?? 0,
        type: existingCost?.type || existingDrop?.type || 'Unknown',
        timestamp: selectedMapData.startTime,
        imageUrl: existingCost?.imageUrl || existingDrop?.imageUrl,
      };
    });
  }, [selectedMapData, costs, drops]);

  // Calculate totals for the selected map
  const totalPickedUp = selectedMapDrops.reduce(
    (sum: number, d: Drop) => sum + d.price * d.quantity,
    0
  );
  const totalCost = selectedMapCosts.reduce(
    (sum: number, c: Drop) => sum + c.price * c.quantity,
    0
  );

  return {
    selectedMapData,
    selectedMapDrops,
    selectedMapCosts,
    totalPickedUp,
    totalCost,
    setSelectedMapNumber,
  };
};

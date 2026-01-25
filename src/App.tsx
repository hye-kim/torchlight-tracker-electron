import { useState, useEffect, useMemo } from 'react';
import StatsCard from './components/StatsCard';
import DropsCard from './components/DropsCard';
import ControlCard from './components/ControlCard';
import SettingsDialog from './components/SettingsDialog';
import OverlaySettings from './components/OverlaySettings';
import LootSummaryDropdown from './components/LootSummaryDropdown';
import InitializationDialog from './components/InitializationDialog';
import MapLogTable from './components/MapLogTable';
import './App.css';

interface DisplayItem {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

interface Config {
  tax: number;
  user: string;
  overlayMode?: boolean;
  clickThrough?: boolean;
  fontSize?: number;
  displayItems?: DisplayItem[];
}

interface Stats {
  currentMap: {
    mapCount: number;
    duration: number;
    feIncome: number;
    incomePerMinute: number;
  };
  total: {
    mapCount: number;
    duration: number;
    feIncome: number;
    incomePerMinute: number;
  };
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
}

interface CurrentMapData {
  mapNumber: number;
  mapName: string;
  startTime: number;
  revenue: number;
  cost: number;
  profit: number;
  duration: number;
  drops?: MapItemData[];
  costs?: MapItemData[];
}

function App() {
  const [config, setConfig] = useState<Config>({ tax: 1, user: '' });
  const [stats, setStats] = useState<Stats | null>(null);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [costs, setCosts] = useState<Drop[]>([]);
  const [mapLogs, setMapLogs] = useState<MapLog[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showOverlaySettings, setShowOverlaySettings] = useState(false);
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWaitingForInit, setIsWaitingForInit] = useState(false);
  const [isInMap, setIsInMap] = useState(false);
  const [currentMap, setCurrentMap] = useState<CurrentMapData | null>(null);
  const [selectedMapNumber, setSelectedMapNumber] = useState<number | null>(null);

  useEffect(() => {
    // Load initial config
    window.electronAPI.getConfig().then(setConfig);

    // Load initial stats
    window.electronAPI.getStats().then(setStats);

    // Load initial drops
    window.electronAPI.getDrops().then(setDrops);

    // Load map logs
    window.electronAPI.getMapLogs?.().then((logs: MapLog[]) => {
      if (logs) setMapLogs(logs);
    });

    // Listen for updates
    window.electronAPI.onUpdateDisplay((data: any) => {
      if (data.stats) setStats(data.stats);
      if (data.drops) setDrops(data.drops);
      if (data.costs) setCosts(data.costs);
      if (data.mapLogs) setMapLogs(data.mapLogs);
      if (data.isInMap !== undefined) setIsInMap(data.isInMap);
      if (data.currentMap) setCurrentMap(data.currentMap);
      if (data.isInitialized !== undefined) setIsInitialized(data.isInitialized);
    });

    window.electronAPI.onInitializationComplete(() => {
      console.log('Initialization complete!');
      setIsInitialized(true);
      setIsWaitingForInit(false);
    });
  }, []);

  // Auto-select current map when in map
  useEffect(() => {
    if (isInMap && currentMap) {
      setSelectedMapNumber(currentMap.mapNumber);
    }
  }, [isInMap, currentMap?.mapNumber]);

  const handleInitializeTracker = async () => {
    setShowInitDialog(true);
    setIsWaitingForInit(true);
    await window.electronAPI.initializeTracker();
  };

  const handleExportExcel = async () => {
    const result = await window.electronAPI.exportExcel();
    if (result.success) {
      alert(`Excel exported successfully to: ${result.filePath}`);
    }
  };

  const handleExportDebugLog = async () => {
    const result = await window.electronAPI.exportDebugLog();
    if (result.success) {
      alert(`Debug log exported to: ${result.filePath}`);
    }
  };

  const handleResetStats = async () => {
    if (confirm('Are you sure you want to reset all statistics?')) {
      await window.electronAPI.resetStats();
      setStats(null);
      setDrops([]);
      setCosts([]);
      setMapLogs([]);
      setCurrentMap(null);
      setIsInMap(false);
      setSelectedMapNumber(null);
    }
  };

  const handleSaveSettings = async (updates: Partial<Config>) => {
    const newConfig = await window.electronAPI.updateConfig(updates);
    setConfig(newConfig);
    setShowSettings(false);
  };

  const handleSaveOverlaySettings = async (updates: Partial<Config>) => {
    const newConfig = await window.electronAPI.updateConfig(updates);
    setConfig(newConfig);
    setShowOverlaySettings(false);
  };

  const handleSelectMap = (mapNumber: number | null) => {
    setSelectedMapNumber(mapNumber);
  };

  const handleWindowMinimize = () => {
    window.electronAPI.windowMinimize();
  };

  const handleWindowMaximize = () => {
    window.electronAPI.windowMaximize();
  };

  const handleWindowClose = () => {
    window.electronAPI.windowClose();
  };

  // Get the selected map data (current map or from map logs)
  const selectedMapData = useMemo(() => {
    if (selectedMapNumber === null) return null;

    // If currently in map and selected the current map
    if (isInMap && currentMap && selectedMapNumber === currentMap.mapNumber) {
      return currentMap;
    }

    // Otherwise find in map logs
    return mapLogs.find(log => log.mapNumber === selectedMapNumber) || null;
  }, [selectedMapNumber, mapLogs, isInMap, currentMap]);

  // Get drops/costs for the selected map
  const selectedMapDrops = useMemo(() => {
    if (!selectedMapData) return [];

    // Convert from map data (either current map or completed map log)
    if (!selectedMapData.drops) return [];

    return selectedMapData.drops.map(item => {
      const existingDrop = drops.find(d => d.itemId === item.itemId);
      return {
        itemId: item.itemId,
        name: existingDrop?.name || `Item ${item.itemId}`,
        quantity: item.quantity,
        price: existingDrop?.price || 0,
        type: existingDrop?.type || 'Unknown',
        timestamp: selectedMapData.startTime,
        imageUrl: existingDrop?.imageUrl,
      };
    });
  }, [selectedMapData, drops]);

  const selectedMapCosts = useMemo(() => {
    if (!selectedMapData) return [];

    // Convert from map data (either current map or completed map log)
    if (!selectedMapData.costs) return [];

    return selectedMapData.costs.map(item => {
      const existingCost = costs.find(c => c.itemId === item.itemId);
      // Try to find price info from drops array if not in costs
      const existingDrop = drops.find(d => d.itemId === item.itemId);
      return {
        itemId: item.itemId,
        name: existingCost?.name || existingDrop?.name || `Item ${item.itemId}`,
        quantity: item.quantity,
        price: existingCost?.price || existingDrop?.price || 0,
        type: existingCost?.type || existingDrop?.type || 'Unknown',
        timestamp: selectedMapData.startTime,
        imageUrl: existingCost?.imageUrl || existingDrop?.imageUrl,
      };
    });
  }, [selectedMapData, costs, drops]);

  // Calculate totals for the selected map
  const totalPickedUp = selectedMapDrops.reduce((sum: number, d: Drop) => sum + d.price * d.quantity, 0);
  const totalCost = selectedMapCosts.reduce((sum: number, c: Drop) => sum + c.price * c.quantity, 0);

  const overlayMode = config.overlayMode ?? false;
  const fontSize = config.fontSize ?? 14;
  const displayItems = config.displayItems ?? [];
  const sortedDisplayItems = [...displayItems].sort((a, b) => a.order - b.order);

  // Helper function to check if a display item is enabled
  const isItemEnabled = (id: string) => {
    const item = displayItems.find(item => item.id === id);
    return item?.enabled ?? true;
  };

  return (
    <div className={`app ${overlayMode ? 'overlay-mode' : ''}`} style={{ fontSize: `${fontSize}px` }}>
      <div className="header">
        <div className="title-bar">
          <h1>Torchlight Tracker</h1>
          <div className="window-controls">
            <button className="settings-btn" onClick={() => setShowOverlaySettings(true)} title="Overlay Settings">
              ⚙️
            </button>
            <button className="window-btn minimize" onClick={handleWindowMinimize} title="Minimize">
              −
            </button>
            <button className="window-btn maximize" onClick={handleWindowMaximize} title="Maximize">
              □
            </button>
            <button className="window-btn close" onClick={handleWindowClose} title="Close">
              ✕
            </button>
          </div>
        </div>
      </div>

      <div className="main-content">
        {overlayMode ? (
          <div className="overlay-content">
            <div className="overlay-stats">
              {sortedDisplayItems.map((item) => {
                if (!item.enabled) return null;

                switch (item.id) {
                  case 'status':
                    return (
                      <div key={item.id} className="overlay-stat-item">
                        <span className="label">Status:</span>
                        <span className={`value ${isInMap ? 'recording' : ''}`}>
                          {isInMap ? '● Recording' : '○ Not Recording'}
                        </span>
                      </div>
                    );
                  case 'currentMap':
                    return (
                      <div key={item.id} className="overlay-stat-item">
                        <span className="label">Current Map:</span>
                        <span className="value">{currentMap?.mapName || 'N/A'}</span>
                      </div>
                    );
                  case 'currentProfitPerMin':
                    return (
                      <div key={item.id} className="overlay-stat-item">
                        <span className="label">Current Profit/min:</span>
                        <span className="value">{stats?.currentMap.incomePerMinute.toFixed(2) || '0.00'} FE</span>
                      </div>
                    );
                  case 'currentProfit':
                    return (
                      <div key={item.id} className="overlay-stat-item">
                        <span className="label">Current Profit:</span>
                        <span className="value">{stats?.currentMap.feIncome.toFixed(2) || '0.00'} FE</span>
                      </div>
                    );
                  case 'totalProfitPerMin':
                    return (
                      <div key={item.id} className="overlay-stat-item">
                        <span className="label">Total Profit/min:</span>
                        <span className="value">{stats?.total.incomePerMinute.toFixed(2) || '0.00'} FE</span>
                      </div>
                    );
                  case 'totalProfit':
                    return (
                      <div key={item.id} className="overlay-stat-item">
                        <span className="label">Total Profit:</span>
                        <span className="value">{stats?.total.feIncome.toFixed(2) || '0.00'} FE</span>
                      </div>
                    );
                  case 'mapDuration':
                    return (
                      <div key={item.id} className="overlay-stat-item">
                        <span className="label">Map Duration:</span>
                        <span className="value">
                          {Math.floor((stats?.currentMap.duration || 0) / 60)}m {(stats?.currentMap.duration || 0) % 60}s
                        </span>
                      </div>
                    );
                  case 'totalDuration':
                    return (
                      <div key={item.id} className="overlay-stat-item">
                        <span className="label">Total Duration:</span>
                        <span className="value">
                          {Math.floor((stats?.total.duration || 0) / 60)}m {(stats?.total.duration || 0) % 60}s
                        </span>
                      </div>
                    );
                  case 'mapCount':
                    return (
                      <div key={item.id} className="overlay-stat-item">
                        <span className="label">Map Count:</span>
                        <span className="value">{stats?.total.mapCount || 0}</span>
                      </div>
                    );
                  default:
                    return null;
                }
              })}
            </div>
            <LootSummaryDropdown
              drops={selectedMapDrops}
              costs={selectedMapCosts}
              totalPickedUp={totalPickedUp}
              totalCost={totalCost}
            />
          </div>
        ) : (
          <>
            <div className="sidebar">
              <StatsCard stats={stats} />
              <ControlCard
                onInitialize={handleInitializeTracker}
                onExportExcel={handleExportExcel}
                onExportDebugLog={handleExportDebugLog}
                onOpenSettings={() => setShowSettings(true)}
                onResetStats={handleResetStats}
                isInitialized={isInitialized}
                isWaitingForInit={isWaitingForInit}
              />
            </div>

            <div className="center-panel">
              <MapLogTable
                mapLogs={mapLogs}
                isInitialized={isInitialized}
                isInMap={isInMap}
                currentMap={currentMap}
                mapCount={stats?.total.mapCount || 0}
                selectedMapNumber={selectedMapNumber}
                onSelectMap={handleSelectMap}
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
        )}
      </div>

      {showSettings && (
        <SettingsDialog
          config={config}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showOverlaySettings && (
        <OverlaySettings
          config={config}
          onSave={handleSaveOverlaySettings}
          onClose={() => setShowOverlaySettings(false)}
        />
      )}

      {showInitDialog && (
        <InitializationDialog onClose={() => setShowInitDialog(false)} />
      )}
    </div>
  );
}

export default App;

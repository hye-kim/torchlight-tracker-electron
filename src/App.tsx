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
  const [showHeader, setShowHeader] = useState(false);

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

  // Set body background to transparent when in overlay mode
  useEffect(() => {
    const overlayMode = config.overlayMode ?? false;
    if (overlayMode) {
      document.body.style.backgroundColor = 'transparent';
    } else {
      document.body.style.backgroundColor = '#1e1e2e';
    }
  }, [config.overlayMode]);

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
    // Don't close dialog - settings are applied in real-time
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

  const handleToggleOverlayMode = async () => {
    const newOverlayMode = !overlayMode;
    const updates = { overlayMode: newOverlayMode };
    const newConfig = await window.electronAPI.updateConfig(updates);
    setConfig(newConfig);

    // Apply overlay mode immediately
    if (window.electronAPI) {
      await window.electronAPI.toggleOverlayMode(newOverlayMode);
    }
  };

  const handleToggleClickThrough = async () => {
    const newClickThrough = !config.clickThrough;
    const updates = { clickThrough: newClickThrough };
    const newConfig = await window.electronAPI.updateConfig(updates);
    setConfig(newConfig);

    // Apply click-through immediately
    if (window.electronAPI) {
      await window.electronAPI.toggleClickThrough(newClickThrough);
    }
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

  // Handle mouse events for click-through mode and header visibility
  const handleHeaderMouseEnter = () => {
    setShowHeader(true);
    if (config.clickThrough && window.electronAPI) {
      window.electronAPI.setIgnoreMouseEvents(false);
    }
  };

  const handleHeaderMouseLeave = () => {
    setShowHeader(false);
    // Don't enable click-through if any dialog is open
    if (config.clickThrough && window.electronAPI && !showOverlaySettings && !showSettingsDialog && !showInitDialog) {
      window.electronAPI.setIgnoreMouseEvents(true);
    }
  };

  return (
    <div className={`app ${overlayMode ? 'overlay-mode' : ''}`} style={{ fontSize: `${fontSize}px` }}>
      {overlayMode ? (
        <>
          <div
            className="header-hover-zone"
            onMouseEnter={handleHeaderMouseEnter}
            onMouseLeave={handleHeaderMouseLeave}
          />
          <div className="header-wrapper">
            <div className={`header ${showHeader ? 'visible' : ''}`}>
              <div className="title-bar">
                <h1>Torchlight Tracker</h1>
                <div className="window-controls">
                  <button
                    className="icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowOverlaySettings(true);
                    }}
                    title="Settings"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"></path>
                    </svg>
                  </button>
                  <button
                    className={`icon-btn ${overlayMode ? 'active' : ''}`}
                    onClick={handleToggleOverlayMode}
                    title="Switch to Full Mode"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"></path>
                    </svg>
                  </button>
                  <button
                    className={`icon-btn ${config.clickThrough ? 'active' : ''}`}
                    onClick={handleToggleClickThrough}
                    title={config.clickThrough ? 'Disable Click-Through' : 'Enable Click-Through'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div
          className="header"
          onMouseEnter={handleHeaderMouseEnter}
          onMouseLeave={handleHeaderMouseLeave}
        >
          <div className="title-bar">
            <h1>Torchlight Tracker</h1>
            <div className="window-controls">
              <button className="window-btn minimize" onClick={handleWindowMinimize} title="Minimize">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14"></path>
                </svg>
              </button>
              <button className="window-btn maximize" onClick={handleWindowMaximize} title="Maximize">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6"></path>
                </svg>
              </button>
              <button className="window-btn close" onClick={handleWindowClose} title="Close">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

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
                onToggleOverlay={handleToggleOverlayMode}
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

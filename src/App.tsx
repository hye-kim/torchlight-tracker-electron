import NavigationSidebar from './components/NavigationSidebar';
import SettingsDialog from './components/SettingsDialog';
import OverlaySettings from './components/OverlaySettings';
import InitializationDialog from './components/InitializationDialog';
import UpdateNotification from './components/UpdateNotification';
import UpdateDialog from './components/UpdateDialog';
import HistoryView from './components/HistoryView';
import { OverviewPage, InventoryPage, OverlayModePage } from './pages';
import {
  useConfigStore,
  useStatsStore,
  useMapStore,
  useInventoryStore,
  useUIStore,
  useUpdateStore,
} from './stores';
import { useElectronData } from './hooks';
import { Config } from './types';
import './App.css';

function App(): JSX.Element {
  // Initialize data loading and IPC listeners
  useElectronData();

  // Zustand stores
  const { config, setConfig, updateConfig } = useConfigStore();
  const { resetStats } = useStatsStore();
  const { resetMap } = useMapStore();
  const { resetInventory } = useInventoryStore();
  const {
    showSettings,
    showOverlaySettings,
    showInitDialog,
    activeView,
    setShowSettings,
    setShowOverlaySettings,
    setShowInitDialog,
    setActiveView,
  } = useUIStore();
  const {
    updateInfo,
    showUpdateNotification,
    showUpdateDialog,
    setShowUpdateNotification,
    setShowUpdateDialog,
  } = useUpdateStore();

  // Window control handlers
  const handleWindowMinimize = (): void => void window.electronAPI.windowMinimize();
  const handleWindowMaximize = (): void => void window.electronAPI.windowMaximize();
  const handleWindowClose = (): void => void window.electronAPI.windowClose();

  // Action handlers
  const handleExportExcel = async (): Promise<void> => {
    const result = await window.electronAPI.exportExcel();
    if (result.success) {
      alert(`Excel exported successfully to: ${result.filePath}`);
    }
  };

  const handleResetStats = async (): Promise<void> => {
    if (confirm('Are you sure you want to reset all statistics?')) {
      await window.electronAPI.resetStats();
      resetStats();
      resetMap();
      resetInventory();
    }
  };

  const handleSaveSettings = async (updates: Partial<Config>): Promise<void> => {
    const newConfig = await window.electronAPI.updateConfig(updates);
    setConfig(newConfig);
    setShowSettings(false);
  };

  const handleSaveOverlaySettings = async (updates: Partial<Config>): Promise<void> => {
    const newConfig = await window.electronAPI.updateConfig(updates);
    setConfig(newConfig);
  };

  const handleToggleOverlayMode = async (): Promise<void> => {
    const newOverlayMode = !config.overlayMode;
    updateConfig({ overlayMode: newOverlayMode });
    await window.electronAPI.toggleOverlayMode(newOverlayMode);
  };

  const handleToggleClickThrough = async (): Promise<void> => {
    const newClickThrough = !config.clickThrough;
    updateConfig({ clickThrough: newClickThrough });
    await window.electronAPI.toggleClickThrough(newClickThrough);
  };

  const handleDownloadUpdate = (): void => {
    setShowUpdateNotification(false);
    setShowUpdateDialog(true);
  };

  const handleDismissUpdate = (): void => {
    setShowUpdateNotification(false);
  };

  const handleSkipUpdate = async (): Promise<void> => {
    if (updateInfo) {
      await window.electronAPI.skipUpdateVersion(updateInfo.version);
      setShowUpdateNotification(false);
    }
  };

  const overlayMode = config.overlayMode ?? false;
  const fontSize = config.fontSize ?? 14;

  return (
    <div
      className={`app ${overlayMode ? 'overlay-mode' : ''}`}
      style={{ fontSize: `${fontSize}px` }}
    >
      {overlayMode ? (
        <OverlayModePage
          onOpenSettings={() => setShowOverlaySettings(true)}
          onToggleOverlay={() => void handleToggleOverlayMode()}
          onToggleClickThrough={() => void handleToggleClickThrough()}
        />
      ) : (
        <>
          <div className="header">
            <div className="window-controls-container">
              <div className="window-controls">
                <button
                  className="window-btn minimize"
                  onClick={handleWindowMinimize}
                  title="Minimize"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14"></path>
                  </svg>
                </button>
                <button
                  className="window-btn maximize"
                  onClick={handleWindowMaximize}
                  title="Maximize"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6"
                    ></path>
                  </svg>
                </button>
                <button className="window-btn close" onClick={handleWindowClose} title="Close">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18 18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="main-content">
            <NavigationSidebar activeView={activeView} onViewChange={setActiveView} />

            {activeView === 'overview' ? (
              <OverviewPage
                onOpenSettings={() => setShowSettings(true)}
                onToggleOverlay={handleToggleOverlayMode}
                onExportExcel={handleExportExcel}
                onResetStats={handleResetStats}
              />
            ) : activeView === 'inventory' ? (
              <InventoryPage />
            ) : (
              <div className="history-panel">
                <HistoryView />
              </div>
            )}
          </div>
        </>
      )}

      {showSettings && (
        <SettingsDialog
          config={config}
          onSave={(updates) => void handleSaveSettings(updates)}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showOverlaySettings && (
        <OverlaySettings
          config={config}
          onSave={(updates) => void handleSaveOverlaySettings(updates)}
          onClose={() => setShowOverlaySettings(false)}
        />
      )}

      {showInitDialog && <InitializationDialog onClose={() => setShowInitDialog(false)} />}

      {showUpdateNotification && updateInfo && (
        <UpdateNotification
          updateInfo={updateInfo}
          onDownload={handleDownloadUpdate}
          onDismiss={handleDismissUpdate}
          onSkip={() => void handleSkipUpdate()}
        />
      )}

      {showUpdateDialog && updateInfo && (
        <UpdateDialog updateInfo={updateInfo} onClose={() => setShowUpdateDialog(false)} />
      )}
    </div>
  );
}

export default App;

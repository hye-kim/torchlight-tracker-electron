import { useEffect } from 'react';
import { useUIStore, useInitStore } from '../stores';

/**
 * Custom hook to handle tracker initialization
 */
export const useInitialization = () => {
  const { setShowInitDialog } = useUIStore();
  const { setIsInitialized, setIsWaitingForInit } = useInitStore();

  useEffect(() => {
    // Listen for initialization completion
    window.electronAPI.onInitializationComplete(() => {
      console.log('Initialization complete!');
      setIsInitialized(true);
      setIsWaitingForInit(false);
    });
  }, [setIsInitialized, setIsWaitingForInit]);

  const handleInitializeTracker = async () => {
    setShowInitDialog(true);
    setIsWaitingForInit(true);
    await window.electronAPI.initializeTracker();
  };

  return { handleInitializeTracker };
};

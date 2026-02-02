import React, { useState, useEffect } from 'react';
import './NavigationSidebar.css';

type NavView = 'overview' | 'inventory';

interface NavigationSidebarProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
}

const NavigationSidebar: React.FC<NavigationSidebarProps> = ({ activeView, onViewChange }) => {
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    // Load app version
    window.electronAPI.getAppVersion().then(setAppVersion);
  }, []);

  return (
    <nav className="nav-sidebar" aria-label="Main navigation">
      <div className="nav-branding">
        <div className="nav-app-name">
          Torchlight
          <br />
          Tracker
        </div>
        <div className="nav-version">v{appVersion}</div>
      </div>

      <ul className="nav-menu" role="list">
        <li role="listitem">
          <button
            className={`nav-item ${activeView === 'overview' ? 'active' : ''}`}
            onClick={() => onViewChange('overview')}
            aria-current={activeView === 'overview' ? 'page' : undefined}
            aria-label="Overview"
          >
            <svg
              className="nav-item-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span className="nav-item-label">Overview</span>
          </button>
        </li>

        <li role="listitem">
          <button
            className={`nav-item ${activeView === 'inventory' ? 'active' : ''}`}
            onClick={() => onViewChange('inventory')}
            aria-current={activeView === 'inventory' ? 'page' : undefined}
            aria-label="Inventory"
          >
            <svg
              className="nav-item-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span className="nav-item-label">Inventory</span>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default NavigationSidebar;

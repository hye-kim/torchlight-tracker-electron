import React from 'react';
import { useConfigStore, useStatsStore, useMapStore } from '../stores';
import { DisplayItem } from '../types';

interface OverlayModePageProps {
  onOpenSettings: () => void;
  onToggleOverlay: () => void;
  onToggleClickThrough: () => void;
}

const OverlayModePage: React.FC<OverlayModePageProps> = ({
  onOpenSettings,
  onToggleOverlay,
  onToggleClickThrough,
}) => {
  const { config } = useConfigStore();
  const { stats } = useStatsStore();
  const { currentMap, isInMap } = useMapStore();

  const displayItems = config.displayItems ?? [];
  const sortedDisplayItems = [...displayItems].sort((a, b) => a.order - b.order);

  const renderStatItem = (item: DisplayItem) => {
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
            <span className="value">
              {stats?.currentMap.incomePerMinute.toFixed(2) || '0.00'} FE
            </span>
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
            <span className="value">
              {stats?.total.incomePerMinute.toFixed(2) || '0.00'} FE
            </span>
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
              {Math.floor((stats?.currentMap.duration ?? 0) / 60)}m{' '}
              {Math.floor((stats?.currentMap.duration ?? 0) % 60)}s
            </span>
          </div>
        );
      case 'totalDuration':
        return (
          <div key={item.id} className="overlay-stat-item">
            <span className="label">Total Duration:</span>
            <span className="value">
              {Math.floor((stats?.total.duration ?? 0) / 60)}m{' '}
              {Math.floor((stats?.total.duration ?? 0) % 60)}s
            </span>
          </div>
        );
      case 'mapCount':
        return (
          <div key={item.id} className="overlay-stat-item">
            <span className="label">Map Count:</span>
            <span className="value">{stats?.total.mapCount ?? 0}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="header-wrapper">
      <div className="header">
        <div className="title-bar">
          <h1>Torchlight Tracker</h1>
          <div className="window-controls interactive">
            <button
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings();
              }}
              title="Settings"
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
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                ></path>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                ></path>
              </svg>
            </button>
            <button
              className="icon-btn active"
              onClick={onToggleOverlay}
              title="Switch to Full Mode"
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
                  d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                ></path>
              </svg>
            </button>
            <button
              className={`icon-btn ${config.clickThrough ? 'active' : ''}`}
              onClick={onToggleClickThrough}
              title={config.clickThrough ? 'Disable Click-Through' : 'Enable Click-Through'}
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
                  d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59"
                ></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="overlay-content">
        <div className="overlay-stats">
          {sortedDisplayItems.map((item) => (item.enabled ? renderStatItem(item) : null))}
        </div>
      </div>
    </div>
  );
};

export default OverlayModePage;

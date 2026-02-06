# React Performance Implementation Plan (Section 4.1)

> Detailed implementation plan for the React performance optimizations described in
> IMPROVEMENT_PLAN.md section 4.1, mapped to the current codebase.

---

## Current State Assessment

### Architecture Summary

- **State management**: Zustand stores (configStore, statsStore, mapStore, inventoryStore, uiStore, updateStore, initStore)
- **Data flow**: Main process polls game log every **1 second** (`LOG_POLL_INTERVAL = 1.0`), emitting `update-display` IPC events with the full payload (stats, drops, costs, mapLogs, currentMap, isInMap, bagInventory)
- **Components**: 15 components + 3 pages, no `React.memo` anywhere, zero `useCallback` usage
- **Existing optimizations**: Good `useMemo` usage in HistoryView and InventoryView; Zustand's selector-based subscriptions limit some re-render propagation

### Key Performance Bottlenecks (Ordered by Impact)

1. **1-second IPC updates** cause `statsStore` to replace `stats`, `drops`, `costs`, `mapLogs` on every tick, triggering re-renders in all subscribing components
2. **MapLogTable** sorts on every render without `useMemo` (line 76)
3. **DropsCard** sorts drops, sorts costs, computes `typeBreakdown`, and sorts types on every render (lines 152-179) — none are memoized
4. **useMapSelection hook** computes `totalPickedUp` and `totalCost` on every render without `useMemo` (lines 77-84)
5. **SessionSelector** sorts sessions on every render without `useMemo` (line 118)
6. **OverlayModePage** sorts `displayItems` on every render without `useMemo` (line 21)
7. **HistoryView** computes `selectedMapName` via IIFE in JSX on every render (lines 270-281)
8. **DropsCard** uses `index` in list keys, causing unnecessary DOM reconciliation (lines 253, 290)
9. No `React.memo` on any component — parent re-renders cascade unconditionally to all children

---

## Implementation Plan

### Phase 1: Memoize Expensive Computations (`useMemo`)

**Priority**: Highest — these are the cheapest fixes with the most impact.

Every sort/reduce/filter that runs on render should be wrapped in `useMemo`. This phase requires no new dependencies and no architectural changes.

#### 1A. MapLogTable.tsx — Memoize sorting

**File**: `src/components/MapLogTable.tsx`
**Current** (line 76-98): `sortedLogs` is computed on every render via `[...mapLogs].sort(...)`.
**Change**: Wrap in `useMemo` with deps `[mapLogs, sortColumn, sortDirection]`.

```tsx
// Before (line 76):
const sortedLogs = [...mapLogs].sort((a, b) => { ... });

// After:
const sortedLogs = useMemo(() => {
  return [...mapLogs].sort((a, b) => { ... });
}, [mapLogs, sortColumn, sortDirection]);
```

Also memoize `displayLogs` (line 107-113) since it depends on `sortedLogs`, `isInMap`, and `currentMap`:

```tsx
const displayLogs = useMemo(() => {
  if (isInMap && currentMap) {
    return [
      { ...currentMap, isActive: true },
      ...sortedLogs.filter((log) => log.mapNumber !== currentMap.mapNumber),
    ];
  }
  return sortedLogs;
}, [sortedLogs, isInMap, currentMap]);
```

**Impact**: MapLogTable renders on every stats update (1/sec). With 50+ maps, sorting is non-trivial. The memoization will skip the sort when only stats change but mapLogs don't.

#### 1B. DropsCard.tsx — Memoize all derived data

**File**: `src/components/DropsCard.tsx`
**Current**: Four separate unmemoized computations run on every render.
**Changes**:

1. **`sortedDrops`** (line 152-156) — wrap in `useMemo([drops])`
2. **`sortedCosts`** (line 159-163) — wrap in `useMemo([costs])`
3. **`typeBreakdown` + `sortedTypes`** (line 166-179) — wrap in `useMemo([sortedDrops, totalPickedUp])`

```tsx
const sortedDrops = useMemo(() =>
  [...drops].sort((a, b) => b.price * b.quantity - a.price * a.quantity),
  [drops]
);

const sortedCosts = useMemo(() =>
  [...costs].sort((a, b) => b.price * b.quantity - a.price * a.quantity),
  [costs]
);

const sortedTypes = useMemo(() => {
  const typeBreakdown = sortedDrops.reduce((acc, item) => {
    const type = (item.type || 'unknown').toLowerCase();
    const total = item.price * item.quantity;
    acc[type] = (acc[type] ?? 0) + total;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(typeBreakdown)
    .sort(([, a], [, b]) => b - a)
    .filter(([, value]) => value > 0);
}, [sortedDrops]);
```

**Impact**: DropsCard re-renders when its parent re-renders. These computations involve sorting and reducing arrays that can contain 20-100+ items per map.

#### 1C. useMapSelection.ts — Memoize totals

**File**: `src/hooks/useMapSelection.ts`
**Current** (lines 77-84): `totalPickedUp` and `totalCost` are plain `reduce` calls, recalculated on every render even when `selectedMapDrops`/`selectedMapCosts` haven't changed.
**Change**: Wrap both in `useMemo`.

```tsx
const totalPickedUp = useMemo(
  () => selectedMapDrops.reduce((sum, d) => sum + d.price * d.quantity, 0),
  [selectedMapDrops]
);

const totalCost = useMemo(
  () => selectedMapCosts.reduce((sum, c) => sum + c.price * c.quantity, 0),
  [selectedMapCosts]
);
```

**Impact**: This hook is consumed by OverviewPage, which renders on every stats tick.

#### 1D. SessionSelector.tsx — Memoize session sorting

**File**: `src/components/SessionSelector.tsx`
**Current** (line 118): `sortedSessions` is `[...sessions].sort(...)` on every render.
**Change**: Wrap in `useMemo([sessions])`.

Also memoize `selectedNonActiveSessions` (line 120-123):

```tsx
const sortedSessions = useMemo(
  () => [...sessions].sort((a, b) => b.startTime - a.startTime),
  [sessions]
);

const selectedNonActiveSessions = useMemo(
  () => selectedSessionIds.filter((id) => {
    const session = sessions.find((s) => s.sessionId === id);
    return session && !session.isActive;
  }),
  [selectedSessionIds, sessions]
);
```

**Impact**: Low — HistoryView only; sessions don't update on the 1-sec tick. But good practice.

#### 1E. OverlayModePage.tsx — Memoize displayItems sort

**File**: `src/pages/OverlayModePage.tsx`
**Current** (line 21): `sortedDisplayItems` is `[...displayItems].sort(...)` on every render.
**Change**: Wrap in `useMemo([displayItems])`.

```tsx
const sortedDisplayItems = useMemo(
  () => [...displayItems].sort((a, b) => a.order - b.order),
  [displayItems]
);
```

**Impact**: Overlay mode renders on every stats tick. The sort is small (9 items max) but this is free to fix.

#### 1F. HistoryView.tsx — Extract selectedMapName from JSX

**File**: `src/components/HistoryView.tsx`
**Current** (lines 270-281): An IIFE inside JSX runs `.find()` on `combinedMapLogs` on every render.
**Change**: Extract to a `useMemo`:

```tsx
const selectedMapName = useMemo(() => {
  if (selectedMapNumber === null || selectedMapSessionId === null) return undefined;
  const selectedMap = combinedMapLogs.find(
    (m) => m.mapNumber === selectedMapNumber && m.sessionId === selectedMapSessionId
  );
  return selectedMap
    ? `${selectedMap.mapName ?? `Map #${selectedMap.mapNumber}`} (${selectedMap.sessionTitle ?? 'Session'})`
    : `Map #${selectedMapNumber}`;
}, [selectedMapNumber, selectedMapSessionId, combinedMapLogs]);
```

Then use: `selectedMapName={selectedMapName}`

**Impact**: Removes a linear search from the render path.

---

### Phase 2: Component Memoization (`React.memo`)

**Priority**: High — prevents unnecessary re-renders from cascading down the tree.

The goal is to wrap **leaf components** and **expensive components** in `React.memo` so they skip re-rendering when their props haven't changed. Because Zustand already limits store-triggered re-renders to subscribers, the primary benefit here is preventing re-renders caused by parent components re-rendering (e.g., App.tsx handler changes, dialog toggles).

#### Component Memoization Matrix

| Component | Wrap in memo? | Custom comparator needed? | Rationale |
|---|---|---|---|
| **StatsBar** | Yes | No (shallow compare on `stats` ref) | Renders on every tick; simple props |
| **ControlsBar** | Yes | No | Stable props (booleans + callbacks) |
| **NavigationSidebar** | Yes | No | Stable props (string + callback) |
| **MapLogTable** | Yes | No | Expensive render; array props from store |
| **DropsCard** | Yes | Yes — compare `drops.length`, `costs.length`, totals | Expensive render; array props |
| **HistoryStatsPanel** | Yes | No | Simple object + string props |
| **SessionSelector** | Yes | No | Array props that change infrequently |
| **InventoryView** | Yes | No | Already has internal memoization |
| **OverlayModePage** | No | — | Top-level page; would need to memo callbacks in App.tsx first |
| **OverviewPage** | No | — | Top-level page; subscribes to stores directly |
| **HistoryView** | No | — | Top-level page with internal state |

#### Implementation Pattern

For each component listed as "Yes" above:

```tsx
// At bottom of file, replace:
export default ComponentName;

// With:
export default React.memo(ComponentName);
```

For **DropsCard**, use a custom comparator to avoid deep array comparison:

```tsx
export default React.memo(DropsCard, (prev, next) => {
  return (
    prev.drops === next.drops &&
    prev.costs === next.costs &&
    prev.totalPickedUp === next.totalPickedUp &&
    prev.totalCost === next.totalCost &&
    prev.selectedMapName === next.selectedMapName
  );
});
```

#### Stabilize Callback Props in App.tsx

For `React.memo` to be effective, callback props must have stable references. Currently App.tsx creates new function references on every render for handlers like `handleExportExcel`, `handleResetStats`, etc.

**File**: `src/App.tsx`
**Change**: Wrap action handlers in `useCallback`:

```tsx
const handleExportExcel = useCallback(async (): Promise<void> => {
  const result = await window.electronAPI.exportExcel();
  if (result.success) {
    alert(`Excel exported successfully to: ${result.filePath}`);
  }
}, []);

const handleResetStats = useCallback(async (): Promise<void> => {
  if (confirm('Are you sure you want to reset all statistics?')) {
    await window.electronAPI.resetStats();
    resetStats();
    resetMap();
    resetInventory();
  }
}, [resetStats, resetMap, resetInventory]);

const handleToggleOverlayMode = useCallback(async (): Promise<void> => {
  // Note: needs current config.overlayMode — use store getter or ref
  const current = useConfigStore.getState().config.overlayMode ?? false;
  const newOverlayMode = !current;
  updateConfig({ overlayMode: newOverlayMode });
  await window.electronAPI.toggleOverlayMode(newOverlayMode);
}, [updateConfig]);
```

Note: Zustand store setters (e.g., `resetStats`, `setConfig`) are stable references by default, so they don't need `useCallback`.

Also stabilize inline arrow callbacks passed to children:

```tsx
// Before:
onOpenSettings={() => setShowSettings(true)}

// After (use useCallback or extract):
const handleOpenSettings = useCallback(() => setShowSettings(true), [setShowSettings]);
// ...
onOpenSettings={handleOpenSettings}
```

**Files affected**: `src/App.tsx`, `src/pages/OverviewPage.tsx`, `src/components/HistoryView.tsx`

---

### Phase 3: Fix List Keys

**Priority**: Medium — incorrect keys cause unnecessary DOM reconciliation.

#### DropsCard.tsx — Remove index from keys

**File**: `src/components/DropsCard.tsx`
**Current**:
- Line 253: `key={`drop-${item.itemId}-${index}`}`
- Line 290: `key={`cost-${item.itemId}-${index}`}`

**Problem**: When the list is re-sorted, items with the same `itemId` get different indices, causing React to unmount/remount DOM nodes instead of reordering them.

**Fix**: Since itemId should be unique within a single map's drops/costs list, use just itemId:

```tsx
// Line 253:
key={`drop-${item.itemId}`}

// Line 290:
key={`cost-${item.itemId}`}
```

If `itemId` is not guaranteed unique within a map (unlikely but possible), use a compound key without index:

```tsx
key={`drop-${item.itemId}-${item.name}`}
```

---

### Phase 4: Debounce High-Frequency IPC Updates

**Priority**: Medium-High — the 1-second polling interval sends the full data payload every tick, triggering 7 Zustand `set()` calls per tick even when data hasn't changed.

#### 4A. Add shallow equality checks in useElectronData

**File**: `src/hooks/useElectronData.ts`
**Current** (line 41-51): Every field from the IPC payload is set unconditionally.
**Change**: Compare incoming data with current store state before setting. Use Zustand's `getState()` for reads without subscribing:

```tsx
window.electronAPI.onUpdateDisplay((data) => {
  if (data.stats) {
    const current = useStatsStore.getState().stats;
    if (!current || !shallowEqual(current, data.stats)) {
      setStats(data.stats);
    }
  }
  if (data.drops) {
    // drops is a new array each time — compare by length + spot check
    const current = useStatsStore.getState().drops;
    if (current.length !== data.drops.length || current[0]?.itemId !== data.drops[0]?.itemId) {
      setDrops(data.drops);
    }
  }
  // ... similar for other fields
});
```

A simpler and more robust approach is to use a **hash/fingerprint** on the backend side and only emit when data actually changes. But since that requires backend changes, the frontend check is a good first step.

#### 4B. Alternative: Debounce the IPC handler

If the shallow-equality approach proves complex, a simpler alternative is to debounce the entire handler:

```tsx
import { useMemo } from 'react';

// Inside useElectronData:
const debouncedHandler = useMemo(
  () => debounce((data: DisplayUpdateData) => {
    if (data.stats) setStats(data.stats);
    if (data.drops) setDrops(data.drops);
    // ... rest of handler
  }, 100),
  [setStats, setDrops, /* ... */]
);

window.electronAPI.onUpdateDisplay(debouncedHandler);
```

This batches updates that arrive within 100ms, reducing re-renders when the log monitor fires at 1-second intervals. The 100ms debounce is imperceptible to users but halves the worst-case render load if events cluster.

**Note**: A debounce utility function is needed. Options:
- Inline implementation (~10 lines)
- Or install a lightweight utility (not recommended — avoid new dependencies for this)

#### 4C. Backend-side optimization (optional, longer term)

**File**: `electron/backend/game/LogMonitor.ts`
**Change**: Only emit `updateDisplay` when data has actually changed. Track previous stats hash and skip emit if identical. This is the most effective solution but requires backend changes.

```typescript
// In LogMonitor's poll method, before emitting:
const payload = { stats, drops, costs, mapLogs, isInMap, currentMap, bagInventory };
const hash = JSON.stringify(payload);
if (hash !== this.lastPayloadHash) {
  this.lastPayloadHash = hash;
  this.emit('updateDisplay', payload);
}
```

---

### Phase 5: Code Splitting (Lazy Loading)

**Priority**: Low — the app is an Electron desktop app where bundle size matters less than in web apps, and all views share the same shell. However, lazy loading heavy views can improve initial render time.

#### 5A. Lazy load HistoryView

**File**: `src/App.tsx`
**Current** (line 7): `import HistoryView from './components/HistoryView';`
**Change**:

```tsx
import { lazy, Suspense } from 'react';

const HistoryView = lazy(() => import('./components/HistoryView'));

// In JSX (line 197-200):
<div className="history-panel">
  <Suspense fallback={<div className="loading-panel">Loading...</div>}>
    <HistoryView />
  </Suspense>
</div>
```

**Rationale**: HistoryView is the most complex component (fetches sessions, aggregates stats, renders sub-components). It's only accessed when the user clicks the History tab. Lazy loading it defers this cost until needed.

#### 5B. Lazy load InventoryPage

**File**: `src/App.tsx` or `src/pages/index.ts`
**Change**: Similar pattern — `InventoryPage` is only shown when navigating to the Inventory tab.

```tsx
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
```

#### 5C. Lazy load dialog components

**Files**: `SettingsDialog`, `OverlaySettings`, `UpdateDialog`
**Change**: These are conditionally rendered behind boolean flags. They can be lazy-loaded since they're only needed when the user explicitly opens them.

```tsx
const SettingsDialog = lazy(() => import('./components/SettingsDialog'));
const OverlaySettings = lazy(() => import('./components/OverlaySettings'));
const UpdateDialog = lazy(() => import('./components/UpdateDialog'));
```

Each needs a `<Suspense>` wrapper where rendered in App.tsx. Since these are modals, a minimal loading fallback (or `null`) is appropriate.

**Impact**: Reduces initial JavaScript parse/eval time. In an Electron app this is a minor improvement (maybe 50-100ms on startup) but costs nothing in complexity.

---

### Phase 6: Virtual Scrolling (Future Consideration)

**Priority**: Low (for now) — worth implementing when users report performance issues with large datasets.

The improvement plan suggests virtualizing MapLogTable, InventoryView, and drops/costs lists. This is the highest-effort change and should only be done if actual performance problems are observed with large lists.

#### When to implement

- **MapLogTable**: When users regularly have 200+ maps in a session. Currently, 50-100 rows render fine.
- **InventoryView**: When bag inventories exceed 200+ unique items. Currently manageable with the collapsible groups pattern.
- **DropsCard**: Unlikely to need virtualization — drops per map are typically 10-30 items.

#### Recommended library

`@tanstack/react-virtual` (formerly react-virtual) — lightweight, headless, works with existing table/list markup.

#### Implementation sketch for MapLogTable

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

// Inside MapLogTable:
const parentRef = useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({
  count: displayLogs.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48, // row height in px
});

// Replace the <tbody> with virtualized rows:
<div ref={parentRef} className="table-wrapper" style={{ overflow: 'auto' }}>
  <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
    {virtualizer.getVirtualItems().map((virtualRow) => {
      const log = displayLogs[virtualRow.index];
      return (
        <div
          key={virtualRow.key}
          style={{
            position: 'absolute',
            top: `${virtualRow.start}px`,
            height: `${virtualRow.size}px`,
            width: '100%',
          }}
        >
          {/* row content */}
        </div>
      );
    })}
  </div>
</div>
```

**Trade-offs**: Virtualization replaces the HTML `<table>` with positioned `<div>` elements, which means:
- Loss of native table column alignment (need CSS grid or flex)
- Additional complexity for sticky headers
- Accessibility impact (loss of table semantics)

**Recommendation**: Defer until Phase 1-4 optimizations are insufficient for real-world usage.

---

## Implementation Order & Dependencies

```
Phase 1 (useMemo)     ← Do first, no dependencies, highest ROI
  │
  ├── 1A. MapLogTable sorting
  ├── 1B. DropsCard sorting/breakdown
  ├── 1C. useMapSelection totals
  ├── 1D. SessionSelector sorting
  ├── 1E. OverlayModePage sorting
  └── 1F. HistoryView selectedMapName
  │
Phase 2 (React.memo)  ← Do second, depends on Phase 1 for full benefit
  │
  ├── Wrap 7 components in React.memo
  ├── Add useCallback to App.tsx handlers
  └── Stabilize inline callbacks
  │
Phase 3 (List keys)   ← Independent, can be done anytime
  │
Phase 4 (Debounce)    ← Do third, independent of Phase 1-2
  │
  ├── 4A. Shallow equality in useElectronData (preferred)
  └── 4B. Debounce handler (simpler alternative)
  │
Phase 5 (Code split)  ← Do fourth, independent
  │
Phase 6 (Virtual)     ← Defer until needed
```

## File Change Summary

| File | Phase | Changes |
|---|---|---|
| `src/components/MapLogTable.tsx` | 1A, 2, 3 | Add `useMemo` for sorting + displayLogs; wrap in `React.memo` |
| `src/components/DropsCard.tsx` | 1B, 2, 3 | Add `useMemo` for 4 computations; fix keys; wrap in `React.memo` with custom comparator |
| `src/hooks/useMapSelection.ts` | 1C | Wrap `totalPickedUp` and `totalCost` in `useMemo` |
| `src/components/SessionSelector.tsx` | 1D, 2 | Add `useMemo` for sorting; wrap in `React.memo` |
| `src/pages/OverlayModePage.tsx` | 1E | Add `useMemo` for displayItems sort |
| `src/components/HistoryView.tsx` | 1F | Extract `selectedMapName` to `useMemo` |
| `src/components/StatsBar.tsx` | 2 | Wrap in `React.memo` |
| `src/components/ControlsBar.tsx` | 2 | Wrap in `React.memo` |
| `src/components/NavigationSidebar.tsx` | 2 | Wrap in `React.memo` |
| `src/components/HistoryStatsPanel.tsx` | 2 | Wrap in `React.memo` |
| `src/components/InventoryView.tsx` | 2 | Wrap in `React.memo` |
| `src/App.tsx` | 2, 5 | Add `useCallback` for handlers; lazy imports with `Suspense` |
| `src/hooks/useElectronData.ts` | 4 | Add shallow equality checks or debounce |

**Total files modified**: 13
**New dependencies**: None for Phase 1-4. `@tanstack/react-virtual` only if Phase 6 is pursued.
**Estimated new/changed lines**: ~200-300

## Verification Strategy

After implementing each phase:

1. **Functional verification**: Ensure all views render correctly, map selection works, stats update in real-time, overlay mode functions, history sessions load and aggregate properly
2. **Performance verification**: Use React DevTools Profiler to:
   - Record a 30-second session with active map tracking
   - Verify memoized components show "Did not render" when props unchanged
   - Confirm render times decrease for MapLogTable and DropsCard
3. **Regression checks**: Test sort toggling in MapLogTable, tab switching in DropsCard, search/filter in InventoryView, session multi-select in HistoryView

---

_Plan created: 2026-02-06_

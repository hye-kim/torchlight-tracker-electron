# Torchlight Tracker - Improvement Plan

> Comprehensive improvement recommendations for architecture, features, performance, and code quality.
> Generated: 2026-02-03

---

## Table of Contents

1. [New Features](#1-new-features)
2. [Architecture Refactoring](#2-architecture-refactoring)
3. [Code Quality Improvements](#3-code-quality-improvements)
4. [Performance Optimizations](#4-performance-optimizations)
5. [User Experience Enhancements](#5-user-experience-enhancements)
6. [Platform & Compatibility](#6-platform--compatibility)
7. [Data & Persistence](#7-data--persistence)
8. [Developer Experience](#8-developer-experience)
9. [Security & Reliability](#9-security--reliability)
10. [Analytics & Feedback](#10-analytics--feedback)
11. [Implementation Guide](#implementation-guide)
12. [Prioritization Framework](#prioritization-framework)

---

## 1. NEW FEATURES

### 1.1 Advanced Analytics & Visualization
- **Charts/Graphs**: Add visual charts for:
  - Income over time (line graph showing FE/hour trends across sessions)
  - Drop distribution pie charts (by item type/rarity)
  - Map efficiency comparison (bar chart comparing profit per map type)
  - Session comparison heat maps
- **Advanced Statistics**:
  - Best/worst maps by profit margin
  - Drop rate analysis (drops per hour by type)
  - Cost efficiency tracking (which consumables yield best ROI)
  - Streak tracking (consecutive profitable maps)
- **Goals & Milestones**: Set income goals, track progress with notifications
- **Predictive Analytics**: Estimate time to reach X flame elementium based on current rate

### 1.2 Data Export & Sharing
- **Multiple Export Formats**:
  - CSV export (simpler alternative to Excel)
  - JSON export (for third-party tools/analysis)
  - PDF report generation with charts
- **Cloud Sync**: Optional cloud backup/sync of session data across devices
- **Import/Export Sessions**: Share session data with friends or import historical data
- **Screenshot Integration**: Auto-capture screenshots of valuable drops

### 1.3 Notifications & Alerts
- **Desktop Notifications**:
  - High-value drop alerts (configurable threshold)
  - Session milestone achievements
  - Unusual events (extremely profitable/unprofitable maps)
- **Sound Effects**: Optional audio cues for drops/map completion
- **Discord Webhook Integration**: Post session summaries to Discord

### 1.4 Multi-Game/Multi-Character Support
- **Character Profiles**: Track different characters separately with profile switching
- **Season Tracking**: Separate data by game season/league
- **Account Aggregation**: View combined stats across all characters

### 1.5 Enhanced Inventory Management
- **Inventory Value Breakdown**: Show total inventory value by category
- **Price Change Alerts**: Notify when owned items significantly change in price
- **Stash Tab Organization**: Visual representation of inventory layout
- **Item Comparison**: Side-by-side comparison of similar items
- **Wishlist/Shopping List**: Track items you want to buy with price alerts

### 1.6 Map Planning & Optimization
- **Map Recommendations**: Suggest most profitable map types based on history
- **Pre-Map Checklist**: Remind to use specific consumables before entering
- **Map Rotation Planner**: Plan and track map rotation strategies
- **Break Timer**: Remind to take breaks after X hours of farming

### 1.7 Social Features
- **Leaderboards**: Compare your stats with friends (opt-in)
- **Party Tracking**: Track group farming sessions with loot split calculations
- **Friend Sync**: See friends' current farming status

---

## 2. ARCHITECTURE REFACTORING

### 2.1 State Management Overhaul
**Problem**: App.tsx has 16+ useState hooks (571 lines total) making it difficult to maintain

**Solutions**:
- **Implement Context API**: Create separate contexts for:
  - `ConfigContext` - app configuration
  - `StatsContext` - statistics data
  - `InventoryContext` - inventory state
  - `SessionContext` - session management
  - `UIContext` - dialog states, active views
- **Or use Zustand/Jotai**: Lightweight state management with better DevTools support
- **Benefits**:
  - Reduce prop drilling
  - Better code organization
  - Easier testing
  - Better performance with selective re-renders

**Implementation Tasks**:
1. Choose state management solution (Context API, Zustand, or Jotai)
2. Create context providers/stores for each domain
3. Refactor App.tsx to use contexts instead of useState
4. Update all child components to consume contexts
5. Update IPC listeners to update context stores
6. Test all functionality still works

**Scope**:
- Files affected: App.tsx + all 16 components
- Lines to refactor: ~500-700 lines across files
- New files: 5-6 context files (if using Context API)

### 2.2 Component Decomposition
**Problem**: App.tsx is a 571-line monolith

**Solutions**:
- **Extract Layout Components**:
  ```
  App.tsx (orchestration only)
  ├── AppLayout (main layout structure)
  ├── OverviewPage (overview view logic)
  ├── InventoryPage (inventory view logic)
  └── HistoryPage (history view logic)
  ```
- **Create Custom Hooks**:
  - `useElectronAPI()` - wrap IPC calls
  - `useStatsData()` - fetch and manage stats
  - `useInventoryData()` - inventory management
  - `useSessionData()` - session operations
- **Benefits**:
  - Easier to test individual features
  - Better code reusability
  - Clearer separation of concerns

**Implementation Tasks**:
1. Extract page components from App.tsx
2. Create custom hooks for data fetching/management
3. Create shared hooks for common patterns
4. Refactor App.tsx to use new pages/hooks
5. Test all functionality

**Scope**:
- App.tsx: ~571 lines → ~100-150 lines
- New files: 3 page components + 6 custom hooks
- Lines to write: ~400-500 new lines

### 2.3 Backend Module Reorganization
**Current**: 16 flat modules in `backend/`

**Proposed Structure**:
```
backend/
├── core/
│   ├── ConfigManager.ts
│   ├── Logger.ts
│   └── constants.ts
├── game/
│   ├── GameDetector.ts
│   ├── LogMonitor.ts
│   └── LogParser.ts
├── tracking/
│   ├── InventoryTracker.ts
│   ├── StatisticsTracker.ts
│   └── SessionManager.ts
├── data/
│   ├── FileManager.ts
│   └── APIClient.ts
├── export/
│   └── ExcelExporter.ts
└── updates/
    └── UpdateManager.ts
```

**Implementation Tasks**:
1. Create new directory structure
2. Move files to appropriate directories (16 files)
3. Update all import paths in backend files and main.ts
4. Update build configuration if needed
5. Test application builds and runs

**Scope**:
- Files to move: 16 backend files
- Import statements to update: ~50-100 across codebase

### 2.4 Dependency Injection
**Problem**: Tight coupling between modules (hard to test)

**Solution**:
```typescript
// Instead of:
class StatisticsTracker {
  constructor() {
    this.fileManager = new FileManager();
    this.configManager = new ConfigManager();
  }
}

// Use dependency injection:
class StatisticsTracker {
  constructor(
    private fileManager: FileManager,
    private configManager: ConfigManager
  ) {}
}
```

**Implementation Tasks**:
1. Identify all tight couplings
2. Refactor each class to accept dependencies via constructor
3. Update main.ts to instantiate and wire dependencies
4. Create interfaces for dependencies (for easier mocking)
5. Update tests to use dependency injection

**Scope**:
- Classes to refactor: ~10 classes
- New interfaces: ~5-8 interfaces
- main.ts: Significant changes to initialization logic

**Benefits**:
- Easier unit testing (mock dependencies)
- More flexible module composition
- Clearer dependency graph

---

## 3. CODE QUALITY IMPROVEMENTS

### 3.1 Testing Infrastructure
**Critical Need**: Zero test coverage currently

**Recommended Setup**:
- **Unit Testing**: Vitest (fast, Vite-compatible)
  - Test LogParser regex patterns
  - Test price calculation logic
  - Test inventory reconciliation
  - Test statistics aggregation
- **Component Testing**: React Testing Library
  - Test InventoryView filtering/sorting
  - Test dialog interactions
  - Test table sorting
- **E2E Testing**: Playwright/Spectron
  - Test full application flow
  - Test IPC communication
  - Test overlay mode switching
- **Coverage Target**: Minimum 70% coverage

**High-Priority Test Cases**:
```typescript
// LogParser.test.ts
describe('LogParser', () => {
  it('should extract price from XchgSearchPrice log', () => {
    const line = 'XchgSearchPrice----SynId:1234,Price:100';
    expect(logParser.parsePriceLine(line)).toEqual({ itemId: '1234', price: 100 });
  });
});

// InventoryTracker.test.ts
describe('InventoryTracker', () => {
  it('should not double-count items when switching pages', () => {
    // Test the recent bug fix
  });
});
```

### 3.2 Error Handling Enhancement
**Current**: Errors mostly silently logged, users unaware

**Improvements**:
- **Error Boundary Component** (React):
  ```tsx
  <ErrorBoundary fallback={<ErrorDisplay />}>
    <App />
  </ErrorBoundary>
  ```
- **User-Facing Error Notifications**:
  - Toast notifications for recoverable errors
  - Error dialog for critical failures
  - Status indicator showing connection state
- **Retry Mechanisms**:
  - Auto-retry for transient API failures
  - Exponential backoff already exists but could be extended
- **Error Reporting**: Optional crash report submission (Sentry integration)

### 3.3 Input Validation
**Current**: No validation on user inputs

**Add Validation For**:
- Tax input (0-100%, numeric only)
- User field (max length, sanitization)
- Font size (8-32px range enforcement)
- Session name/description inputs
- Custom price manual entry
- File path inputs

**Implementation**:
```typescript
// Form validation helper
const validateTax = (value: number): string | null => {
  if (value < 0 || value > 100) return 'Tax must be between 0-100%';
  if (!Number.isFinite(value)) return 'Tax must be a valid number';
  return null;
};
```

### 3.4 TypeScript Strict Mode Enforcement
**Current**: Strict mode enabled but some areas could be stricter

**Enhancements**:
- Enable `noUncheckedIndexedAccess` (safer array/object access)
- Add `@typescript-eslint` with recommended rules
- Remove any remaining `any` types
- Add JSDoc comments for complex functions
- Use `const` assertions where appropriate

**Implementation Tasks**:
1. Enable `noUncheckedIndexedAccess` in tsconfig.json
2. Install ESLint TypeScript plugin
3. Configure recommended TypeScript rules
4. Fix all new TypeScript errors (could be 50-200+ errors)
5. Add JSDoc comments to complex functions
6. Replace remaining `any` types (if found)
7. Add `const` assertions where beneficial

**Scope**:
- TypeScript errors to fix: Unknown until enabled (likely 50-200)
- JSDoc to add: ~30-50 functions
- Files affected: Most TypeScript files

### 3.5 Code Documentation
**Add**:
- **README sections**:
  - Architecture diagram
  - Contributing guide
  - API documentation for IPC handlers
- **Inline Documentation**:
  - JSDoc for all public methods
  - Explain complex regex patterns in LogParser
  - Document initialization phases
- **Architecture Decision Records (ADRs)**: Document why certain decisions were made

---

## 4. PERFORMANCE OPTIMIZATIONS

### 4.1 React Performance
**Current Issues**:
- No memoization on components
- Potentially excessive re-renders
- Large lists without virtualization

**Optimizations**:
- **Component Memoization**:
  ```tsx
  export default React.memo(DropsCard, (prev, next) =>
    prev.drops === next.drops && prev.costs === next.costs
  );
  ```
- **Virtual Scrolling**: Use `react-virtual` or `react-window` for:
  - MapLogTable (can grow to hundreds of entries)
  - InventoryView (large inventories)
  - Drops/costs lists
- **Debounce Updates**: Debounce high-frequency IPC events
  ```typescript
  const debouncedUpdate = useMemo(
    () => debounce((data) => setStats(data), 100),
    []
  );
  ```
- **Code Splitting**: Lazy load heavy components
  ```tsx
  const HistoryView = lazy(() => import('./components/HistoryView'));
  ```

**Implementation Tasks**:
1. Identify components that re-render unnecessarily
2. Wrap with `React.memo()` + comparison function (~8-10 components)
3. Install and implement virtual scrolling (3 components)
4. Add debouncing to high-frequency IPC handlers
5. Implement code splitting for large components
6. Test performance improvements

**Scope**:
- React.memo: ~8-10 components
- Virtual scrolling: 3 components (significant refactor each)
- Debouncing: ~3-5 IPC handlers
- Code splitting: 2-3 lazy components

### 4.2 Backend Performance
**Optimizations**:
- **Log Parsing**:
  - Pre-compile regex patterns (already doing this)
  - Consider binary search for sorted data
  - Cache parsed results for duplicate log lines
- **File I/O**:
  - Batch writes to config.json (currently writes on every change)
  - Use streaming for large file reads
  - Implement write coalescing (delay + batch multiple writes)
- **API Client**:
  - Implement request batching
  - Add cache warmup on startup
  - Use HTTP/2 for multiplexing

**Implementation Tasks**:
1. Add caching for duplicate log lines with LRU eviction
2. Implement config write coalescing
3. Implement API request batching
4. Add cache warmup on app startup
5. Test performance improvements

**Scope**:
- Log parsing cache: ~50 lines of code
- Config write batching: ~100-150 lines (new module)
- API batching: ~100 lines
- Cache warmup: ~30 lines

### 4.3 Memory Management
**Add**:
- **Drop History Limits**:
  - Cap `dropList` to last 1000 items (currently unlimited)
  - Archive old data to disk
- **Cache Eviction**:
  - LRU cache for APIClient (currently just TTL)
  - Periodic cleanup of stale session data
- **Memory Profiling**: Add heap snapshot capability for debugging leaks

**Implementation Tasks**:
1. Add max size to dropList (1000 items)
2. Implement ring buffer or FIFO eviction
3. Replace TTL-only cache with LRU cache
4. Add periodic in-memory cleanup
5. Add memory usage logging
6. Test behavior when limits reached

**Scope**:
- Drop limits: ~50-100 lines
- LRU cache: ~100 lines (or use library)
- Session cleanup: ~50 lines

### 4.4 Startup Optimization
**Current**: Sequential loading of all modules

**Optimize**:
- **Parallel Loading**: Load independent data in parallel
  ```typescript
  await Promise.all([
    fileManager.loadItemDatabase(),
    fileManager.loadPriceTable(),
    sessionManager.loadSessions(),
  ]);
  ```
- **Lazy Loading**: Defer non-critical module initialization
- **Splash Screen**: Show progress while loading

**Implementation Tasks**:
1. Identify all sequential `await` calls in initialization
2. Group independent operations
3. Use `Promise.all()` for parallel execution
4. Defer non-critical module initialization
5. Create splash screen UI
6. Test startup still works correctly

**Scope**:
- Parallel loading: ~20-30 lines changed
- Lazy loading: Depends on DI implementation
- Splash screen: ~100-150 lines (new component + IPC)

---

## 5. USER EXPERIENCE ENHANCEMENTS

### 5.1 UI/UX Polish
- **Dark/Light Theme Toggle**: Add theme switcher
- **Customizable Color Schemes**: Let users pick accent colors
- **Animations**: Smooth transitions between views, drop animations
- **Keyboard Shortcuts**:
  - `Ctrl+R` - Reset stats
  - `Ctrl+I` - Initialize tracker
  - `Ctrl+E` - Export to Excel
  - `Ctrl+,` - Open settings
  - `F11` - Toggle fullscreen
  - `Ctrl+Tab` - Cycle views
- **Tooltips**: Explain metrics (what is "FE income"?)
- **Empty States**: Better messaging when no data exists
- **Loading States**: Skeleton screens instead of blank areas

### 5.2 Accessibility
- **ARIA Labels**: Screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus Management**: Proper focus indicators
- **High Contrast Mode**: Accessibility theme
- **Font Scaling**: Support system font size preferences

### 5.3 Onboarding
- **First-Run Tutorial**: Explain features step-by-step
- **Feature Discovery**: Highlight new features after updates
- **Quick Start Guide**: In-app getting started wizard
- **Demo Mode**: Show example data before game detection

### 5.4 Overlay Improvements
**Current**: Basic overlay with limited customization

**Enhancements**:
- **Custom Layouts**: Drag-and-drop widget positioning
- **Widget System**: Modular widgets (stats, timer, drops preview)
- **Multiple Overlays**: Separate windows for different data
- **Corner Snapping**: Auto-snap to screen corners
- **Hotkey Show/Hide**: Global hotkey to toggle overlay
- **Transparency Per-Widget**: Different opacity for each widget
- **Compact Mode**: Ultra-minimal mode showing only income/hour

### 5.5 Settings Organization
**Current**: Single settings dialog

**Improve**:
- **Tabbed Settings**: Categories (General, Overlay, Export, Advanced)
- **Search Settings**: Search box to find specific settings
- **Reset to Defaults**: Per-section reset buttons
- **Import/Export Settings**: Share config between installations

---

## 6. PLATFORM & COMPATIBILITY

### 6.1 Cross-Platform Support
**Current**: Windows-only (GameDetector uses WMIC/tasklist)

**Add Support For**:
- **macOS**: Use `ps` or `pgrep` for process detection
- **Linux**: Use `/proc` filesystem for process enumeration
- **Manual Log Path**: Let users manually specify log file location
- **Game Path Auto-Detection**: Search common installation directories

**Implementation**:
```typescript
class GameDetector {
  async findGame(): Promise<GameInfo | null> {
    switch (process.platform) {
      case 'win32': return this.findGameWindows();
      case 'darwin': return this.findGameMacOS();
      case 'linux': return this.findGameLinux();
    }
  }
}
```

### 6.2 Update System Enhancement
**Current**: Manual download, signature verification disabled

**Improvements**:
- **Code Signing**: Invest in code signing certificate
- **Auto-Update**: Enable automatic background updates
- **Update Channels**: Stable/Beta/Nightly builds
- **Rollback**: Allow reverting to previous version
- **Update Notes**: Show changelog before updating
- **Delta Updates**: Download only changed files (electron-updater supports this)

---

## 7. DATA & PERSISTENCE

### 7.1 Database Migration
**Current**: JSON files for everything

**Consider**:
- **SQLite**: For session history and drops (better querying)
  - Enables complex queries (e.g., "show all maps where profit > 1000 FE")
  - Better performance for large datasets
  - ACID transactions
- **Keep JSON for**: Config, price tables (simple, human-readable)

**Implementation Tasks**:
1. Design tables for sessions, maps, drops, costs
2. Install `better-sqlite3` or `sql.js`
3. Create database initialization module
4. Write DAO (Data Access Object) classes
5. Implement CRUD operations for each table
6. Write migration script (JSON → SQLite)
7. Backup existing JSON files
8. Run migration on first launch with new version
9. Verify data integrity
10. Refactor SessionManager to use database
11. Update all session queries
12. Test all CRUD operations

**Scope**:
- New files: Database module, DAOs, migration script (~500-800 lines)
- Files to refactor: SessionManager, StatisticsTracker, FileManager (~300-400 lines changed)
- Migration script: ~200-300 lines
- SQL schema: ~100-150 lines

**Benefits**:
- Faster historical queries
- Indexing for performance
- Easier data backup/restore
- Support for advanced filters

### 7.2 Data Migration System
**Add**:
- **Schema Versioning**: Track data format version
- **Auto-Migration**: Upgrade old data on app update
- **Backup Before Migration**: Prevent data loss
- **Migration Rollback**: Undo failed migrations

**Implementation Tasks**:
1. Add schema version to config
2. Create migration runner
3. Implement migration scripts (one per version)
4. Add rollback capability
5. Detect version mismatch on startup
6. Run migrations in sequence
7. Backup before migration
8. Test migration from each old version

**Scope**:
- Migration framework: ~300-400 lines
- Per-version migrations: ~100-200 lines each
- Backup system: ~100 lines

---

## 8. DEVELOPER EXPERIENCE

### 8.1 Development Tooling
- **ESLint + Prettier**: Enforce consistent code style
- **Husky**: Pre-commit hooks for linting/testing
- **Commitlint**: Enforce conventional commit messages
- **Renovate/Dependabot**: Auto-update dependencies
- **GitHub Actions**: CI/CD pipeline
  - Run tests on PR
  - Build artifacts on release
  - Auto-publish to GitHub Releases

**ESLint + Prettier Implementation Tasks**:

**ESLint Setup**:
1. Install dependencies:
   ```bash
   npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
   npm install -D eslint-plugin-react eslint-plugin-react-hooks
   ```
2. Create `.eslintrc.json` configuration
3. Add npm scripts for linting
4. Fix all ESLint errors
5. Add `.eslintignore` file

**Prettier Setup**:
1. Install dependencies:
   ```bash
   npm install -D prettier eslint-config-prettier eslint-plugin-prettier
   ```
2. Create `.prettierrc.json` configuration
3. Update ESLint config to work with Prettier
4. Add npm scripts for formatting
5. Format all existing code
6. Add `.prettierignore` file

**Husky Setup**:
1. Install Husky and lint-staged
2. Initialize Husky
3. Configure lint-staged in package.json
4. Add pre-commit hook
5. Test hook fires on commit

**Scope**:
- Config files: 4-5 new files
- ESLint errors to fix: Unknown (likely 50-300)
- Code formatting changes: All files (automatic)
- npm scripts: ~6 new scripts

### 8.2 Debugging Improvements
- **Better Logging**:
  - Log levels (DEBUG, INFO, WARN, ERROR)
  - Structured logging (JSON format)
  - Log rotation (max 10 files, 10MB each)
  - In-app log viewer
- **DevTools Integration**:
  - React DevTools in production (toggle-able)
  - Redux DevTools (if implementing Redux)
- **Performance Monitoring**:
  - Measure IPC call latency
  - Track render times
  - Memory usage dashboard

### 8.3 Documentation
- **Component Storybook**: Visual component documentation
- **API Documentation**: Auto-generate from TypeScript types
- **Architecture Diagrams**: Visual system overview (use Mermaid)
- **Contributing Guide**: How to add new features
- **Code Examples**: Common patterns and recipes

---

## 9. SECURITY & RELIABILITY

### 9.1 Security Hardening
- **Content Security Policy**: Restrict resource loading
- **Input Sanitization**: Prevent XSS in user inputs
- **Safe External Links**: Validate URLs before opening
- **Secure Storage**: Encrypt sensitive config values
- **Regular Dependency Audits**: `npm audit` in CI

### 9.2 Error Recovery
- **Graceful Degradation**: App should work even if:
  - Game not found (manual mode)
  - API unavailable (cached prices)
  - Log file locked (retry with backoff)
- **Crash Recovery**: Save state before crash, restore on restart
- **Safe Mode**: Boot with minimal features if last session crashed

### 9.3 Data Integrity
- **Checksum Validation**: Verify loaded JSON files
- **Backup System**: Auto-backup before destructive operations
- **Transaction Safety**: Atomic writes for critical data
- **Corruption Recovery**: Detect and repair corrupt data files

---

## 10. ANALYTICS & FEEDBACK

### 10.1 Usage Analytics (Privacy-Respecting)
- **Optional Telemetry**: Opt-in anonymous usage stats
  - Most-used features
  - Average session length
  - Error frequency
  - Performance metrics
- **Privacy-First**: No PII, local-only processing option
- **Transparency**: Show exactly what's being tracked

### 10.2 In-App Feedback
- **Feedback Button**: Easy bug reporting
- **Feature Voting**: Let users vote on feature requests
- **Issue Templates**: Pre-filled GitHub issue templates
- **Error Report Submission**: One-click crash report sending

---

## IMPLEMENTATION GUIDE

### Breakdown Summary

| Area | Sub-tasks | Files Affected | New Code (est.) | Refactored Code (est.) | Risk Level |
|------|-----------|----------------|-----------------|------------------------|------------|
| **2.1 State Management** | 6 tasks | ~20 files | ~500 lines | ~700 lines | Medium |
| **2.2 Component Decomposition** | 5 tasks | ~17 files | ~500 lines | ~400 lines | Medium |
| **2.3 Module Reorganization** | 5 tasks | ~20 files | 0 lines | ~100 imports | Low |
| **2.4 Dependency Injection** | 5 tasks | ~15 files | ~300 lines | ~400 lines | Medium-High |
| **3.4 TypeScript Strict** | 7 tasks | Most files | ~100 lines | 50-200 fixes | Low-Medium |
| **4.1 React Performance** | 4 groups | ~12 files | ~300 lines | ~400 lines | Medium |
| **4.2 Backend Performance** | 3 groups | ~5 files | ~300 lines | ~100 lines | Medium |
| **4.3 Memory Management** | 3 tasks | ~5 files | ~250 lines | ~50 lines | Low-Medium |
| **4.4 Startup Optimization** | 3 tasks | ~5 files | ~250 lines | ~100 lines | Low-Medium |
| **7.1 Database Migration** | 5 tasks | ~10 files | ~1000 lines | ~500 lines | **High** |
| **7.2 Migration System** | 4 tasks | ~5 files | ~600 lines | ~100 lines | Medium-High |
| **8.1 ESLint + Prettier** | 3 groups | All files | ~50 lines | 50-300 fixes | Low-Medium |

### Recommended Sequencing

**Week 1-2:**
- ESLint + Prettier (establishes code standards)
- TypeScript Strict Mode (catches bugs early)
- Module Reorganization (low risk, improves navigation)

**Week 3-4:**
- State Management Refactor (foundation for everything else)
- Component Decomposition (builds on state refactor)

**Week 5-6:**
- React Performance optimizations (now that components are organized)
- Backend Performance optimizations (independent work)

**Week 7-8:**
- Memory Management (straightforward optimizations)
- Startup Optimization (quick wins)

**Week 9-12:**
- Data Migration System (framework first)
- Database Migration (biggest change, do last when everything else is stable)

**Optional/Later:**
- Dependency Injection (only if planning extensive testing)

### What Can Be Parallelized

**Can parallelize:**
- ESLint/Prettier + TypeScript Strict (both affect code style)
- Module Reorganization (doesn't conflict with logic changes)
- Backend Performance + Memory Management (different files)
- React Performance (if working in separate components)

**Cannot parallelize:**
- State Management must come before Component Decomposition
- Migration System must come before Database Migration
- Dependency Injection should come after Testing Infrastructure

### Risk Factors to Consider

1. **State Management Refactor** - High chance of breaking existing functionality, needs extensive testing
2. **Database Migration** - Risk of data loss, needs careful planning and backups
3. **Virtual Scrolling** - Can be tricky to get right, may need UI adjustments
4. **Dependency Injection** - Can create circular dependency issues
5. **Write Coalescing** - Must ensure data isn't lost on crash

---

## PRIORITIZATION FRAMEWORK

### High Priority (Do First)
1. ✅ **Testing Infrastructure** - Foundation for quality
2. ✅ **State Management Refactor** - App.tsx is becoming unmaintainable
3. ✅ **Error Handling & UI Feedback** - Users are currently blind to errors
4. ✅ **Input Validation** - Prevent data corruption
5. ✅ **Performance: Virtual Scrolling** - Will become an issue as data grows

### Medium Priority (Do Soon)
1. 📊 **Charts/Visualization** - High user value
2. 🔔 **Notifications** - Greatly improves UX
3. 🗂️ **Database Migration** - Better scalability
4. ⚙️ **Settings Organization** - Growing complexity
5. 🎨 **UI Polish** - Keyboard shortcuts, animations, themes

### Low Priority (Nice to Have)
1. 🌐 **Cross-Platform Support** - If expanding user base
2. ☁️ **Cloud Sync** - Convenience feature
3. 🤝 **Social Features** - Niche use case
4. 📱 **Multiple Overlays** - Power user feature
5. 🎯 **Advanced Analytics** - For hardcore users

### Impact vs. Effort Matrix

| Feature | Impact | Effort | ROI |
|---------|--------|--------|-----|
| Testing Infrastructure | 🔥🔥🔥 | 🔨🔨🔨 | ⭐⭐⭐ |
| State Management Refactor | 🔥🔥🔥 | 🔨🔨🔨 | ⭐⭐⭐ |
| Error UI Feedback | 🔥🔥🔥 | 🔨 | ⭐⭐⭐⭐ |
| Charts/Graphs | 🔥🔥🔥 | 🔨🔨 | ⭐⭐⭐⭐ |
| Desktop Notifications | 🔥🔥 | 🔨 | ⭐⭐⭐⭐ |
| Keyboard Shortcuts | 🔥🔥 | 🔨 | ⭐⭐⭐⭐ |
| Virtual Scrolling | 🔥🔥 | 🔨🔨 | ⭐⭐⭐ |
| Database Migration | 🔥🔥 | 🔨🔨🔨🔨 | ⭐⭐ |
| Cross-Platform | 🔥 | 🔨🔨🔨 | ⭐⭐ |
| Cloud Sync | 🔥 | 🔨🔨🔨🔨 | ⭐ |

### Quick Wins (Implement This Week)

1. **Add Keyboard Shortcuts** (2 hours)
   - Easy to implement, huge UX boost

2. **Error Toast Notifications** (3 hours)
   - Use `react-toastify`, immediate user value

3. **Empty State Messages** (1 hour)
   - Better UX when no data available

4. **Loading Skeletons** (2 hours)
   - Perceived performance improvement

5. **Tooltips on Metrics** (2 hours)
   - Helps users understand what stats mean

6. **Settings Reset Button** (1 hour)
   - Safety feature users appreciate

7. **Copy Stats to Clipboard** (1 hour)
   - Easy sharing of session stats

---

## NOTES

- This plan was generated based on a comprehensive codebase analysis
- Prioritization assumes a single developer working sequentially
- Actual implementation may require adjustments based on discovered complexities
- Always backup data before major refactoring, especially database migration
- Consider user feedback when prioritizing new features
- Test thoroughly after each major change

---

*Last Updated: 2026-02-03*

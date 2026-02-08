import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDuckDBViewStore } from '@/store/duckDBViewStore';

// Mock DuckDB initialization
vi.mock('@/lib/duckdb/init', () => ({
  initializeDuckDB: vi.fn(),
  cleanup: vi.fn(),
}));

/**
 * These tests verify that the dataVersion mechanism in duckDBViewStore
 * correctly signals data freshness changes, which the useDuckDBView hook
 * uses to trigger re-queries after pull/sync operations.
 *
 * The useDuckDBView hook includes `activeDataVersion` as a dependency
 * in its query useEffect. When createViewFromData() is called (e.g. after
 * a Google Sheets pull), dataVersion is incremented, causing the effect
 * to re-run and fetch fresh data.
 */
describe('useDuckDBView — data refresh via dataVersion', () => {
  const mockQuery = vi.fn();
  const mockConnection = { query: mockQuery };
  const mockDb = {
    registerFileText: vi.fn().mockResolvedValue(undefined),
  };

  const viewName = 'gsheet_test_123';

  function setupView(opts?: { dataVersion?: number }) {
    useDuckDBViewStore.setState({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock connection for testing
      connection: mockConnection as any,
      isInitialized: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock db for testing
      db: mockDb as any,
      views: new Map([[viewName, {
        viewName,
        fileName: `${viewName}.data`,
        fileType: 'csv' as const,
        schema: [
          { name: '_rowid', type: 'BIGINT' },
          { name: 'Name', type: 'VARCHAR' },
          { name: 'Age', type: 'INTEGER' },
        ],
        totalRows: 3,
        createdAt: Date.now(),
      }]]),
      activeViewName: viewName,
      dataVersion: new Map([[viewName, opts?.dataVersion ?? 1]]),
      pendingChanges: new Map(),
      committedVersions: new Map(),
      currentVersionIndex: new Map(),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ toArray: () => [] });
  });

  describe('dataVersion increments on createViewFromData', () => {
    it('should increment dataVersion when createViewFromData is called', async () => {
      setupView({ dataVersion: 1 });

      // Mock DuckDB operations for createViewFromData
      mockQuery.mockResolvedValueOnce({ toArray: () => [] }) // DROP TABLE
        .mockResolvedValueOnce({ toArray: () => [] }) // CREATE TABLE
        .mockResolvedValueOnce({ toArray: () => [] }) // DROP delta table
        .mockResolvedValueOnce({ toArray: () => [] }) // CREATE delta table
        .mockResolvedValueOnce({
          toArray: () => [
            { column_name: '_rowid', column_type: 'BIGINT' },
            { column_name: 'Name', column_type: 'VARCHAR' },
            { column_name: 'Age', column_type: 'INTEGER' },
          ],
        }); // DESCRIBE

      const beforeVersion = useDuckDBViewStore.getState().dataVersion.get(viewName);

      await useDuckDBViewStore.getState().createViewFromData(
        viewName,
        [{ Name: 'Alice', Age: 30 }, { Name: 'Bob', Age: 25 }],
        ['Name', 'Age']
      );

      const afterVersion = useDuckDBViewStore.getState().dataVersion.get(viewName);
      expect(afterVersion).toBe((beforeVersion ?? 0) + 1);
    });

    it('should increment dataVersion each time createViewFromData is called', async () => {
      setupView({ dataVersion: 5 });

      // Mock for first call
      mockQuery.mockResolvedValue({
        toArray: () => [
          { column_name: '_rowid', column_type: 'BIGINT' },
          { column_name: 'Name', column_type: 'VARCHAR' },
        ],
      });

      await useDuckDBViewStore.getState().createViewFromData(
        viewName,
        [{ Name: 'Alice' }],
        ['Name']
      );

      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBe(6);

      await useDuckDBViewStore.getState().createViewFromData(
        viewName,
        [{ Name: 'Bob' }],
        ['Name']
      );

      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBe(7);
    });
  });

  describe('dataVersion is unique per view', () => {
    it('should track separate dataVersions for different views', async () => {
      const otherView = 'gsheet_other_456';

      useDuckDBViewStore.setState(state => {
        const newViews = new Map(state.views);
        newViews.set(otherView, {
          viewName: otherView,
          fileName: `${otherView}.data`,
          fileType: 'csv' as const,
          schema: [{ name: '_rowid', type: 'BIGINT' }, { name: 'X', type: 'VARCHAR' }],
          totalRows: 1,
          createdAt: Date.now(),
        });
        const newDataVersion = new Map(state.dataVersion);
        newDataVersion.set(otherView, 10);
        return { views: newViews, dataVersion: newDataVersion };
      });

      setupView({ dataVersion: 3 });

      // Only the test view should have version 3
      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBe(3);
    });

    it('should not affect other view versions when one view is recreated', async () => {
      const otherView = 'gsheet_other_789';

      setupView({ dataVersion: 2 });

      useDuckDBViewStore.setState(state => {
        const newDataVersion = new Map(state.dataVersion);
        newDataVersion.set(otherView, 7);
        return { dataVersion: newDataVersion };
      });

      // Recreate the main view
      mockQuery.mockResolvedValue({
        toArray: () => [
          { column_name: '_rowid', column_type: 'BIGINT' },
          { column_name: 'Name', column_type: 'VARCHAR' },
        ],
      });

      await useDuckDBViewStore.getState().createViewFromData(
        viewName,
        [{ Name: 'Fresh' }],
        ['Name']
      );

      // Main view version incremented
      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBe(3);
      // Other view version unchanged
      expect(useDuckDBViewStore.getState().dataVersion.get(otherView)).toBe(7);
    });
  });

  describe('pull/sync simulation', () => {
    it('should simulate a Google Sheets pull that triggers dataVersion change', async () => {
      setupView({ dataVersion: 1 });

      // Simulate what pullGoogleSheet does:
      // 1. Fetch new data from Google Sheets API (mocked)
      const freshData = [
        { Name: 'Updated Alice', Age: 31 },
        { Name: 'Updated Bob', Age: 26 },
        { Name: 'New Charlie', Age: 40 },
      ];

      // 2. Call createViewFromData (drops + recreates DuckDB table)
      mockQuery.mockResolvedValue({
        toArray: () => [
          { column_name: '_rowid', column_type: 'BIGINT' },
          { column_name: 'Name', column_type: 'VARCHAR' },
          { column_name: 'Age', column_type: 'INTEGER' },
        ],
      });

      await useDuckDBViewStore.getState().createViewFromData(
        viewName,
        freshData,
        ['Name', 'Age']
      );

      // 3. Verify dataVersion incremented (this is what triggers useDuckDBView to re-query)
      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBe(2);
    });

    it('should simulate push followed by version cleanup', async () => {
      setupView({ dataVersion: 3 });

      // After a successful push, clearCommittedVersions is called
      // but dataVersion should NOT be affected
      useDuckDBViewStore.setState(state => {
        const cv = new Map(state.committedVersions);
        cv.set(viewName, [{
          id: 'v1',
          changes: [],
          timestamp: Date.now(),
          description: 'test',
        }]);
        return { committedVersions: cv };
      });

      useDuckDBViewStore.getState().clearCommittedVersions(viewName);

      // dataVersion stays the same — no data replacement happened
      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBe(3);
      // But committed versions are gone
      expect(useDuckDBViewStore.getState().committedVersions.get(viewName)).toBeUndefined();
    });

    it('should simulate force-pull after conflict (full data replacement)', async () => {
      setupView({ dataVersion: 2 });

      // User chose "Use Remote Version" in conflict dialog
      // This calls pullGoogleSheet which calls createViewFromData
      mockQuery.mockResolvedValue({
        toArray: () => [
          { column_name: '_rowid', column_type: 'BIGINT' },
          { column_name: 'Name', column_type: 'VARCHAR' },
          { column_name: 'Age', column_type: 'INTEGER' },
        ],
      });

      await useDuckDBViewStore.getState().createViewFromData(
        viewName,
        [{ Name: 'Remote Alice', Age: 99 }],
        ['Name', 'Age']
      );

      // dataVersion bumped
      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBe(3);

      // Then clearCommittedVersions is called to discard local edit history
      useDuckDBViewStore.getState().clearCommittedVersions(viewName);

      // dataVersion still at 3
      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBe(3);
    });
  });

  describe('hook dependency chain', () => {
    /**
     * This test verifies the contract between the store and the hook:
     * The useDuckDBView hook reads `storeDataVersion.get(activeViewName)`
     * as `activeDataVersion` and includes it in the query useEffect deps.
     *
     * When dataVersion changes (map reference changes), Zustand triggers
     * a re-render. The hook then sees a new `activeDataVersion` value,
     * causing the useEffect to re-run and fetch fresh data.
     */
    it('should produce a new Map reference when dataVersion is bumped', () => {
      setupView({ dataVersion: 1 });

      const mapBefore = useDuckDBViewStore.getState().dataVersion;

      // Simulate what createViewFromData does internally
      useDuckDBViewStore.setState(state => {
        const newDataVersion = new Map(state.dataVersion);
        newDataVersion.set(viewName, 2);
        return { dataVersion: newDataVersion };
      });

      const mapAfter = useDuckDBViewStore.getState().dataVersion;

      // New Map reference — Zustand will detect this as a change
      expect(mapBefore).not.toBe(mapAfter);
      // But value for the view is correctly incremented
      expect(mapAfter.get(viewName)).toBe(2);
    });

    it('should not change dataVersion on setActiveView', () => {
      setupView({ dataVersion: 5 });

      useDuckDBViewStore.getState().setActiveView(viewName);

      // setActiveView only changes activeViewName, not dataVersion
      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBe(5);
    });

    it('should not change dataVersion on queryView', async () => {
      setupView({ dataVersion: 3 });

      mockQuery.mockResolvedValueOnce({
        toArray: () => [{ _rowid: 1, Name: 'Alice', Age: 30 }],
      }).mockResolvedValueOnce({
        toArray: () => [{ count: 3 }],
      });

      await useDuckDBViewStore.getState().queryView(viewName, { page: 0, pageSize: 50 });

      // Querying data doesn't change dataVersion
      expect(useDuckDBViewStore.getState().dataVersion.get(viewName)).toBe(3);
    });
  });
});

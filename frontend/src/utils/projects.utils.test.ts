import { describe, it, expect } from 'vitest';
import { sortProjectsByPriority } from './projects.utils';

describe('workspace.utils', () => {
  describe('sortWorkspacesByPriority', () => {
    it('should prioritize draft workspaces', () => {
      const workspaces = [
        { id: '1', name: 'Z Workspace', isDraft: false },
        { id: '2', name: 'A Workspace', isDraft: false },
        { id: '3', name: 'Draft', isDraft: true },
      ];

      const sorted = sortProjectsByPriority(workspaces);
      expect(sorted[0].isDraft).toBe(true);
    });

    it('should sort by last modified when available', () => {
      const workspaces = [
        { id: '1', name: 'Old', isDraft: false, lastModified: 1000 },
        { id: '2', name: 'New', isDraft: false, lastModified: 2000 },
        { id: '3', name: 'Middle', isDraft: false, lastModified: 1500 },
      ];

      const sorted = sortProjectsByPriority(workspaces);
      expect(sorted[0].name).toBe('New');
      expect(sorted[1].name).toBe('Middle');
      expect(sorted[2].name).toBe('Old');
    });

    it('should sort alphabetically when no last modified', () => {
      const workspaces = [
        { id: '1', name: 'Zebra', isDraft: false },
        { id: '2', name: 'Apple', isDraft: false },
        { id: '3', name: 'Banana', isDraft: false },
      ];

      const sorted = sortProjectsByPriority(workspaces);
      expect(sorted[0].name).toBe('Apple');
      expect(sorted[1].name).toBe('Banana');
      expect(sorted[2].name).toBe('Zebra');
    });
  });
});

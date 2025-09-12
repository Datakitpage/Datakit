/**
 * Sort projects by priority
 */
export const sortProjectsByPriority = (workspaces: any[]): any[] => {
  return [...workspaces].sort((a, b) => {
    // Draft always first
    if (a.isDraft && !b.isDraft) return -1;
    if (!a.isDraft && b.isDraft) return 1;
    
    // Then by last modified or name
    if (a.lastModified && b.lastModified) {
      return b.lastModified - a.lastModified;
    }
    
    return a.name.localeCompare(b.name);
  });
};
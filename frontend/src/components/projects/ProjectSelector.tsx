import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Cloud, FolderOpen } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useCloudStore } from '@/store/cloudStore';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/auth/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useNotifications } from '@/hooks/useNotifications';
import AuthModal from '@/components/auth/AuthModal';
import { sortProjectsByPriority } from '@/utils/projects.utils';
import {
  ProjectItem,
  ProjectCreator,
  ProjectHeader,
  DraftSaver,
} from './ProjectSelector/index';
import { ShareProjectModal } from '@/components/project-sharing/ShareProjectModal';

export const ProjectSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [projectToShare, setProjectToShare] = useState<{ id: string; name: string } | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Get local project state from appStore
  const {
    localProjects: projects,
    activeProjectId,
    projectFiles,
    createLocalProject: createProject,
    switchLocalProject: switchProject,
    renameLocalProject: renameProject,
    deleteLocalProject: deleteProject,
    saveDraftProject,
  } = useAppStore();

  // Get cloud store state
  const {
    cloudProjects,
    currentCloudProject,
    storageStats,
    createCloudProject,
    switchToCloudProject,
    switchToLocalWorkspace: switchToLocalProject,
    loadCloudProjects,
    loadStorageStats,
    formatStorageSize,
  } = useCloudStore();

  // Get authentication state
  const { isAuthenticated } = useAuth();
  const { currentWorkspaceId } = useAuthStore();

  // Get notifications
  const { showSuccess } = useNotifications();

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const isCloudActive = currentCloudProject !== null;

  // Determine current project name and icon
  const currentProjectName = isCloudActive
    ? currentCloudProject?.name
    : activeProject?.name || 'Choose Project';

  const currentProjectIcon = isCloudActive ? (
    <Cloud className="h-4 w-4 text-purple-400" />
  ) : (
    <FolderOpen className="h-4 w-4 text-primary/70" />
  );

  // Calculate non-draft project count for limit checking
  const nonDraftProjectCount = projects.filter((p) => !p.isDraft).length;

  // Load cloud projects when authenticated and dropdown is open
  useEffect(() => {
    if (isAuthenticated && isOpen) {
      loadCloudProjects();
      loadStorageStats();
    }
  }, [isAuthenticated, isOpen]);

  // Calculate dropdown position
  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(320, rect.width), // Ensure at least 320px width
      });
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      updateDropdownPosition();
      // Update position on scroll/resize
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen]);

  const handleCreateProject = async (
    projectName: string,
    type: 'local' | 'cloud'
  ) => {
    if (type === 'cloud') {
      if (!isAuthenticated) {
        setShowAuthModal(true);
        return;
      }

      try {
  
        await createCloudProject(currentWorkspaceId, projectName);
        showSuccess(
          'Cloud Project Ready!',
          `"${projectName}" is now synced across your devices`,
          { icon: 'check', duration: 4000 }
        );
      } catch (error) {
        console.error('Failed to create cloud project:', error);
      }
    } else {
      // Check project limit for non-authenticated users
      if (!isAuthenticated && nonDraftProjectCount >= 1) {
        console.log(
          '[ProjectSelector] Project limit reached for non-authenticated user'
        );
        setShowAuthModal(true);
        return;
      }

      // Create local project if under limit or authenticated
      createProject(projectName);

      // Show success notification
      showSuccess(
        'Project Created!',
        `"${projectName}" is ready for your data`,
        { icon: 'check', duration: 4000 }
      );
    }

    setIsOpen(false);
  };

  const handleRenameProject = (id: string, newName: string) => {
    const oldName = projects.find((p) => p.id === id)?.name;

    renameProject(id, newName);

    // Show success notification
    showSuccess('Project Renamed!', `"${oldName}" is now called "${newName}"`, {
      icon: 'check',
      duration: 4000,
    });
  };

  const handleDeleteProject = (id: string) => {
    if (id === 'draft') return; // Can't delete draft

    const project = projects.find((p) => p.id === id);
    const confirmed = confirm(
      `Remove project "${project?.name}"? Your files won't be deleted, just the project organization.`
    );
    if (confirmed && project) {
      deleteProject(id);

      // Show success notification
      showSuccess(
        'Project Removed',
        `"${project.name}" has been removed (files are safe)`,
        { icon: 'check', duration: 4000 }
      );
    }
  };

  const handleSwitchProject = (id: string) => {
    switchProject(id);
    setIsOpen(false);
  };

  const handleToggleDropdown = () => {
    if (!isOpen) {
      updateDropdownPosition();
    }
    setIsOpen(!isOpen);
  };

  const handleSaveDraft = (projectName: string) => {
    // Check project limit for non-authenticated users
    // When saving draft, this would create a new non-draft project
    if (!isAuthenticated && nonDraftProjectCount >= 1) {
      console.log(
        '[ProjectSelector] Cannot save draft - project limit reached for non-authenticated user'
      );
      setIsOpen(false);
      setShowAuthModal(true);
      return;
    }

    // Save draft if under limit or authenticated
    const fileCount = projectFiles.length;

    saveDraftProject(projectName);

    // Show success notification
    showSuccess(
      'Work Saved!',
      `"${projectName}" now contains ${fileCount} file${
        fileCount !== 1 ? 's' : ''
      } and is ready to use`,
      { icon: 'check', duration: 5000 }
    );

    setIsOpen(false);
  };

  const handleShareProject = (project: any) => {
    setProjectToShare({ id: project.id, name: project.name });
    setShowShareModal(true);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
        {/* Project Selector Button */}
      <button
        ref={buttonRef}
        onClick={handleToggleDropdown}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-lg transition-all duration-200 group cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {currentProjectIcon}
          <span className="text-sm font-medium text-white">
            {currentProjectName}
          </span>
          {activeProject?.isDraft && !isCloudActive ? (
            <span className="text-[10px] text-white/50 bg-white/10 px-1.5 py-0.5 rounded">
              unsaved
            </span>
          ) : null}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-white/60 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Portal Dropdown Menu */}
      {isOpen &&
        createPortal(
          <AnimatePresence>
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="fixed bg-black border border-white/15 rounded-lg shadow-xl overflow-hidden z-50"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
              }}
            >
              {/* Header with explanation and help */}
              <ProjectHeader
                isAuthenticated={isAuthenticated}
                nonDraftProjectCount={nonDraftProjectCount}
                storageStats={storageStats}
                formatStorageSize={formatStorageSize}
              />
              {/* Project List */}
              <div className="max-h-80 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/30">
                <div className="space-y-4">
                  {/* Cloud Projects */}
                  {cloudProjects.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                        Cloud Projects
                      </h4>
                      <div className="grid gap-2">
                        {cloudProjects.map((project) => {
                          const isActive =
                            currentCloudProject?.id === project.id;

                          return (
                            <ProjectItem
                              key={project.id}
                              project={project}
                              isActive={isActive}
                              isCloud={true}
                              onSelect={() => {
                                switchToCloudProject(project.id);
                                setIsOpen(false);
                              }}
                              onRename={handleRenameProject}
                              onDelete={handleDeleteProject}
                              onShare={handleShareProject}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Local Projects */}
                  {projects.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                        Local Projects
                      </h4>
                      <div className="grid gap-2">
                        {sortProjectsByPriority(projects).map(
                          (project) => {
                            const isActive =
                              !isCloudActive &&
                              project.id === activeProjectId;

                            return (
                              <ProjectItem
                                key={project.id}
                                project={project}
                                isActive={isActive}
                                isCloud={false}
                                onSelect={() => {
                                  if (isCloudActive) {
                                    switchToLocalProject();
                                  }
                                  handleSwitchProject(project.id);
                                  setIsOpen(false);
                                }}
                                onRename={handleRenameProject}
                                onDelete={handleDeleteProject}
                              />
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {projects.length === 0 && cloudProjects.length === 0 && (
                    <div className="text-center py-8 text-white/40 text-sm">
                      No projects yet. Create your first one below!
                    </div>
                  )}
                </div>
              </div>

              {/* Save Draft Project */}
              {activeProject?.isDraft && activeProject.files.length > 0 && (
                <div className="border-t border-white/10 p-2">
                  <DraftSaver
                    onSave={handleSaveDraft}
                    fileCount={activeProject.files.length}
                  />
                </div>
              )}

              {/* Create New Project */}
              <div className="border-t border-white/10 p-3">
                <ProjectCreator
                  isAuthenticated={isAuthenticated}
                  nonDraftProjectCount={nonDraftProjectCount}
                  onCreateProject={handleCreateProject}
                  onShowAuthModal={() => {
                    setShowAuthModal(true);
                    setIsOpen(false);
                  }}
                />
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

      {/* Auth Modal for project limit */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="signup"
        onLoginSuccess={() => {
          setShowAuthModal(false);
        }}
      />

      {/* Share Project Modal */}
      {projectToShare && (
        <ShareProjectModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setProjectToShare(null);
          }}
          projectId={projectToShare.id}
          projectName={projectToShare.name}
        />
      )}
    </div>
  );
};
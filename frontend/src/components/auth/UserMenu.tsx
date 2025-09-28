import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Settings,
  LogOut,
  CreditCard,
  ChevronDown,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAIStore } from '@/store/aiStore';
import { useAuth } from '@/hooks/auth/useAuth';
import { useNotifications } from '@/hooks/useNotifications';

import { Button } from '@/components/ui/Button';
import LoadingDots from '@/components/ui/LoadingDots';
import AuthModal from './AuthModal';

interface UserMenuProps {
  variant?: 'sidebar' | 'header' | 'collapsed';
  className?: string;
}

const UserMenu: React.FC<UserMenuProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const { setActiveProvider } = useAIStore();
  const { showSuccess } = useNotifications();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>(
    'login'
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setShowDropdown(false);

    // Show success notification for signout
    showSuccess(
      'Signed out successfully',
      "You've been securely signed out of DataKit.",
      {
        icon: 'shield',
        duration: 3000,
      }
    );
  };

  const goToSettings = () => {
    setShowDropdown(false);
    // Navigate to settings page
    window.location.href = '/settings';
  };

  const handleOpenAuthModal = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  if (!isAuthenticated) {
    if (variant === 'collapsed') {
      return (
        <div className="flex gap-1 items-center">
          {/* Sign In Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenAuthModal('login')}
            className={`p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors ${className}`}
            title="Sign In"
          >
            <LogIn size={14} />
          </motion.button>

          {/* Sign Up Button */}
          <motion.button
            whileHover={{
              scale: 1.05,
            }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenAuthModal('signup')}
            className="p-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 rounded transition-all duration-200"
            title="Sign Up"
          >
            <UserPlus size={14} className="text-primary" />
          </motion.button>

          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            defaultMode={authModalMode}
            onLoginSuccess={() => setActiveProvider('datakit')}
          />
        </div>
      );
    }

    return (
      <div className="w-full space-y-2">
        {/* Sign Up Button */}
        <motion.button
          whileHover={{
            scale: 1.02,
            boxShadow: '0 0 25px rgba(139, 92, 246, 0.3)',
          }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleOpenAuthModal('signup')}
          className="w-full py-2 px-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border border-purple-500/30 hover:border-purple-400/50 rounded-lg transition-all duration-300 group"
          disabled={isLoading}
        >
          <div className="flex items-center justify-center">
            <span className="text-xs font-medium text-foreground group-hover:text-purple-100 transition-colors cursor-pointer">
              Get Started Free
            </span>
          </div>
        </motion.button>
        {/* Sign In Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenAuthModal('login')}
          className={`w-full border border-border hover:border-border/60 ${className}`}
          disabled={isLoading}
        >
          {isLoading ? (
            <LoadingDots size="sm" />
          ) : (
            <LogIn size={14} className="mr-1" />
          )}
          <span className="text-xs">{isLoading ? '' : 'Sign In'}</span>
        </Button>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultMode={authModalMode}
          onLoginSuccess={() => setActiveProvider('datakit')}
        />
      </div>
    );
  }

  // Get user initials for avatar fallback
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email[0].toUpperCase() || '?';

  if (variant === 'collapsed') {
    return (
      <>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={`p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors ${className}`}
            title={user?.name || user?.email}
          >
            {/* Avatar Icon Only */}
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-medium text-primary-foreground">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || user.email}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
          </button>
        </div>

        {/* Dropdown Menu positioned as fixed overlay */}
        <AnimatePresence>
          {showDropdown && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                onClick={() => setShowDropdown(false)}
              />

              {/* Dropdown positioned to the right of collapsed sidebar - using fixed positioning */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: -10 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 30,
                  duration: 0.15,
                }}
                className="fixed left-20 bottom-20 w-48 bg-popover backdrop-blur-xl border border-border rounded-lg shadow-2xl py-1 z-50"
              >
                <div className="px-3 py-2 border-b border-border">
                  <div className="text-sm font-medium text-foreground">
                    {user?.name || 'User'}
                  </div>
                  <div className="text-xs text-muted-foreground">{user?.email}</div>
                </div>

                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToSettings}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings size={14} />
                  Settings
                </motion.button>

                <hr className="border-border my-1" />

                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LogOut size={14} />
                  Sign Out
                </motion.button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`w-full flex items-center gap-2 py-2 px-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer ${className}`}
        >
          {/* Avatar */}
          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-medium text-primary-foreground">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || user.email}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-medium truncate">
              {user?.name || 'User'}
            </div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>

          <ChevronDown
            size={14}
            className={`transition-transform ${
              showDropdown ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu with Animation */}
        <AnimatePresence>
          {showDropdown && (
            <>
              {/* Invisible click area to close dropdown */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed left-0 top-0 bottom-0 w-64 z-40"
                onClick={() => setShowDropdown(false)}
              />

              {/* Dropdown */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                  duration: 0.2,
                }}
                className="absolute bottom-full left-0 mb-2 w-full bg-popover backdrop-blur-xl border border-border rounded-lg shadow-2xl py-1 z-50"
              >
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToSettings}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Settings size={14} />
                  Settings
                </motion.button>

                <hr className="border-border my-1" />

                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <LogOut size={14} />
                  Sign Out
                </motion.button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Header variant
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-2 p-2 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ${className}`}
      >
        {/* Avatar */}
        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-medium text-white">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name || user.email}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>

        <ChevronDown
          size={14}
          className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu with Animation */}
      <AnimatePresence>
        {showDropdown && (
          <>
            {/* Transparent Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setShowDropdown(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
                duration: 0.2,
              }}
              className="absolute right-0 top-full mt-2 w-48 bg-popover backdrop-blur-xl border border-border rounded-lg shadow-2xl py-1 z-50"
            >
              <div className="px-3 py-2 border-b border-border">
                <div className="text-sm font-medium text-foreground">
                  {user?.name || 'User'}
                </div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
              </div>

              <motion.button
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={goToSettings}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings size={14} />
                Settings
              </motion.button>

              <motion.button
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setShowDropdown(false);
                  // Open billing portal or subscription management
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <CreditCard size={14} />
                Billing
              </motion.button>

              <hr className="border-white/10 my-1" />

              <motion.button
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserMenu;

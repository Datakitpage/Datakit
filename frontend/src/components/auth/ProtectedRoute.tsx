import React, { useState } from 'react';
import { useRequireAuth } from '@/hooks/auth/useRequireAuth';
import AuthModal from './AuthModal';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAuth?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallback,
  requireAuth = true 
}) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const { isAuthenticated, isLoading } = useRequireAuth({
    onUnauthorized: () => {
      if (requireAuth) {
        setShowAuthModal(true);
      }
    },
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show auth modal if not authenticated and auth is required
  if (!isAuthenticated && requireAuth) {
    return (
      <>
        {fallback || (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Authentication Required
              </h3>
              <p className="text-muted-foreground mb-4">
                Please sign in to access this feature.
              </p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-primary hover:text-primary-foreground transition-colors"
              >
                Sign In
              </button>
            </div>
          </div>
        )}
        
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultMode="login"
        />
      </>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
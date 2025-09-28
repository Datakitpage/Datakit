import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import AuthModal from './AuthModal';
import { Button } from '../ui/Button';
import { useAIStore } from '@/store/aiStore';

interface SignupPromptPopupProps {
  onClose: () => void;
}

const SignupPromptPopup: React.FC<SignupPromptPopupProps> = ({ onClose }) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');

  const { setActiveProvider } = useAIStore();

  const handleSignupClick = () => {
    setAuthMode('signup');
    setShowAuthModal(true);
  };

  const handleLoginClick = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    setActiveProvider('datakit');
    onClose();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{
          duration: 0.2,
          ease: [0.23, 1, 0.32, 1],
        }}
        className="fixed top-4 right-4 z-40 max-w-sm will-change-transform"
        style={{
          transform: 'translate3d(0, 0, 0)',
          contain: 'layout style paint',
        }}
      >
        <div className="bg-popover border border-border rounded-lg shadow-2xl p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-medium text-sm text-foreground">
              The data platform that works your way
            </h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors ml-2"
            >
              <X className="w-4 h-4 cursor-pointer" />
            </button>
          </div>

          {/* Content */}
          <div className="mb-4">
            <p className="text-muted-foreground text-xs leading-relaxed mb-4">
              Your data, your choice. Process locally for complete privacy or leverage cloud when you need to collaborate.
            </p>

            {/* Simplified benefit showcase */}
            <div className="bg-gradient-to-r from-cyan-500/10 to-teal-500/10 rounded-md p-3 border border-cyan-500/20 mb-3">
              <span className="text-xs font-medium text-foreground block mb-2">
                What you get free
              </span>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• All cloud connectors</li>
                <li>• $3 DataKit Assistant credits</li>
                <li>• Unlimited local projects</li>
                <li>• Export & visualizations</li>
              </ul>
            </div>

            {/* Team/Enterprise teaser */}
            <div className="px-3 py-2 bg-card/5 rounded-md border border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground">Enterprise ready</span>
                <a
                  href="https://datakit.studio/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Contact us →
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                Deploy on-premise for complete control or hybrid cloud for flexibility. SOC2 compliant infrastructure.
              </p>
            </div>
          </div>

          {/* Actions - streamlined */}
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={handleSignupClick}
              className="w-full px-4 py-2.5 text-sm bg-gradient-to-r from-cyan-500/10 to-teal-500/10 text-foreground border border-cyan-500/30 hover:border-cyan-500/50 rounded transition-all font-medium hover:shadow-lg hover:shadow-cyan-500/10"
            >
              Start free with $3 credits →
            </Button>
            <Button
              variant="outline"
              onClick={handleLoginClick}
              className="w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/60 rounded transition-colors"
            >
              Already have an account? Sign in
            </Button>
          </div>
        </div>
      </motion.div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode={authMode}
        onLoginSuccess={handleAuthSuccess}
      />
    </>
  );
};

export default SignupPromptPopup;

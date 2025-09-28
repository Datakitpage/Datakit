import React, { useState } from 'react';
import { Shield, LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import AuthModal from '@/components/auth/AuthModal';

export interface AuthGateBenefit {
  icon: LucideIcon;
  text: string;
}

export interface AuthGateProps {
  title?: string;
  description?: string;
  benefits?: AuthGateBenefit[];
  buttonText?: string;
  iconColor?: string;
  iconBgColor?: string;
  buttonClassName?: string;
}

const AuthGate: React.FC<AuthGateProps> = ({
  title = "Sign In Required",
  description = "This feature requires authentication to ensure security and enable advanced functionality.",
  benefits = [],
  iconColor = "text-blue-400",
  iconBgColor = "bg-gradient-to-br from-blue-500/20 to-purple-500/20",
  buttonClassName = "",
}) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('signup');

  return (
    <>
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-6">
          <div className={`w-16 h-16 ${iconBgColor} rounded-full flex items-center justify-center mb-4 mx-auto`}>
            <Shield className={`h-8 w-8 ${iconColor}`} />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            {description}
          </p>
          
          {benefits.length > 0 && (
            <div className="space-y-2 text-xs text-muted-foreground mb-6">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <div key={index} className="flex items-center justify-center">
                    <Icon className="h-3 w-3 mr-2" />
                    <span>{benefit.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="space-y-4 w-full max-w-xs">
          {/* Primary CTA - Get Started Free */}
          <motion.button
            whileHover={{
              scale: 1.02,
              boxShadow: '0 0 25px rgba(139, 92, 246, 0.3)',
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setShowAuthModal(true);
              setAuthModalMode('signup');
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border border-purple-500/30 hover:border-purple-400/50 rounded-lg transition-all duration-300 group cursor-pointer"
          >
            <div className="flex items-center justify-center">
              <span className="text-sm font-medium text-foreground group-hover:text-purple-100 transition-colors">
                Get Started Free
              </span>
            </div>
          </motion.button>
          
          {/* Secondary CTA - Sign In */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">Already have an account?</p>
            <Button
              variant="outline"
              onClick={() => {
                setShowAuthModal(true);
                setAuthModalMode('login');
              }}
              className={`w-full border-border hover:border-border/60 text-muted-foreground hover:text-foreground ${buttonClassName}`}
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>
      
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={() => setShowAuthModal(false)}
        defaultMode={authModalMode}
      />
    </>
  );
};

export default AuthGate;
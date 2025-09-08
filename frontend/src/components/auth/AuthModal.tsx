import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  AlertCircle,
  Check,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/auth/useAuth';
import { PasswordValidator } from '@/lib/duckdb/utils/passwordValidator';
import { useNotifications } from '@/hooks/useNotifications';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'signup';
  onLoginSuccess?: () => void;
}

interface PasswordStrength {
  isValid: boolean;
  score: number;
  feedback: string[];
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
    noCommonPatterns: boolean;
    noPersonalInfo: boolean;
  };
}

interface PasswordRequirements {
  requirements: string[];
  strengthLevels: Array<{
    score: number;
    label: string;
    color: string;
  }>;
}

const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'login',
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);

  // Update mode when defaultMode prop changes
  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  const [passwordStrength, setPasswordStrength] =
    useState<PasswordStrength | null>(null);
  const [passwordRequirements, setPasswordRequirements] =
    useState<PasswordRequirements | null>(null);

  const { login, signup, isLoading, error, clearError } = useAuth();
  const { showSuccess } = useNotifications();

  // Load password requirements from frontend validator (no API call needed)
  useEffect(() => {
    if (isOpen) {
      setPasswordRequirements(PasswordValidator.getPasswordRequirements());
    }
  }, [isOpen]);

  // Instant password strength checker using frontend validator
  const checkPasswordStrength = useCallback(
    (password: string) => {
      if (!password || password.length < 1) {
        setPasswordStrength(null);
        return;
      }

      // Use frontend validator for instant feedback
      const result = PasswordValidator.validatePasswordWithPersonalInfo(
        password,
        {
          email: formData.email,
          name: formData.name,
        }
      );

      setPasswordStrength(result);
    },
    [formData.email, formData.name, formData.password]
  );

  useEffect(() => {
    if (mode === 'signup' && formData.password) {
      checkPasswordStrength(formData.password);
    } else {
      setPasswordStrength(null);
    }
  }, [formData.password, mode, checkPasswordStrength]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For signup, check if password meets requirements
    if (mode === 'signup' && passwordStrength && !passwordStrength.isValid) {
      return; // Don't submit if password is invalid
    }

    try {
      if (mode === 'login') {
        await login({
          email: formData.email,
          password: formData.password,
        });

        // Show success notification for login
        showSuccess(
          'Welcome back!',
          "You've successfully signed in to DataKit.",
          {
            icon: 'shield',
            duration: 3000,
          }
        );

        onLoginSuccess?.();
      } else {
        await signup({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        });

        // Show success notification for signup
        showSuccess(
          'Welcome to DataKit!',
          `Your account has been created successfully. You now have access to DataKit models with 3$ to get started.`,
          {
            icon: 'user',
            duration: 6000,
          }
        );
        onLoginSuccess?.();
      }
      onClose();
    } catch (error) {
      // Error is handled by the auth store
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    clearError();
    setFormData({ email: '', password: '', name: '' });
    setPasswordStrength(null);
  };

  const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-2 text-xs ${
        met ? 'text-green-400' : 'text-white/60'
      }`}
    >
      <div
        className={`w-3 h-3 rounded-full flex items-center justify-center ${
          met ? 'bg-green-500' : 'bg-white/20'
        }`}
      >
        {met && <Check size={8} className="text-white" />}
      </div>
      <span>{text}</span>
    </motion.div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
              duration: 0.3,
            }}
            className="bg-black backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl w-full max-w-md relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-medium text-white">
                  {mode === 'login' ? 'Welcome Back' : 'Join DataKit'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name field - only for signup */}
                {mode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User
                        size={16}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50"
                      />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 bg-background/20 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                  </motion.div>
                )}

                {/* Email field */}
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50"
                    />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 bg-background/20 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-10 py-3 bg-background/20 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                      placeholder={
                        mode === 'login'
                          ? 'Enter your password'
                          : 'Create a strong password'
                      }
                      required
                      minLength={mode === 'signup' ? 12 : 6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white/70 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Password Strength Indicator - only for signup */}
                  {mode === 'signup' && formData.password && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 space-y-3"
                    >
                      {/* Requirements Checklist */}
                      {passwordStrength && (
                        <div className="bg-background/10 rounded-md p-3 border border-white/5">
                          <h4 className="text-xs font-medium text-white/90 mb-2">
                            Security Requirements
                          </h4>
                          <div className="space-y-1">
                            <RequirementItem
                              met={passwordStrength.requirements.minLength}
                              text="At least 12 characters long"
                            />
                            <RequirementItem
                              met={passwordStrength.requirements.hasUppercase}
                              text="Contains uppercase letter (A-Z)"
                            />
                            <RequirementItem
                              met={passwordStrength.requirements.hasLowercase}
                              text="Contains lowercase letter (a-z)"
                            />
                            <RequirementItem
                              met={passwordStrength.requirements.hasNumbers}
                              text="Contains number (0-9)"
                            />
                            <RequirementItem
                              met={
                                passwordStrength.requirements.hasSpecialChars
                              }
                              text="Contains special character (!@#$%^&*...)"
                            />
                            <RequirementItem
                              met={
                                passwordStrength.requirements.noCommonPatterns
                              }
                              text="No common patterns or sequences"
                            />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Error message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
                  >
                    <AlertCircle
                      size={16}
                      className="text-destructive flex-shrink-0"
                    />
                    <span className="text-sm text-destructive">{error}</span>
                  </motion.div>
                )}

                {/* Submit button */}
                <Button
                  variant="outline"
                  type="submit"
                  className="w-full py-3"
                  disabled={
                    isLoading ||
                    (mode === 'signup' &&
                      passwordStrength &&
                      !passwordStrength.isValid)
                  }
                >
                  {isLoading
                    ? mode === 'login'
                      ? 'Signing In...'
                      : 'Creating Account...'
                    : mode === 'login'
                    ? 'Sign In'
                    : 'Create Account'}
                </Button>
              </form>

              {/* Mode toggle */}
              <div className="mt-6 text-center">
                <span className="text-sm text-white/70">
                  {mode === 'login'
                    ? "Don't have an account? "
                    : 'Already have an account? '}
                </span>
                <button
                  onClick={toggleMode}
                  className="text-sm text-primary hover:text-primary-foreground transition-colors font-medium cursor-pointer"
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </div>

              {/* Privacy Notice - only for signup */}
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 text-center"
                >
                  <p className="text-xs text-white/60">
                    By creating an account, you agree to our{' '}
                    <a
                      href="/privacy"
                      target="_blank"
                      className="text-primary hover:text-primary-foreground transition-colors inline-flex items-center gap-1"
                    >
                      Privacy Policy
                      <ExternalLink size={10} />
                    </a>
                  </p>
                </motion.div>
              )}

              {/* Benefits section for signup */}
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mt-6 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-md border border-primary/20"
                >
                  <h3 className="text-sm font-medium text-white/90 mb-3 flex items-center gap-2">
                    Why join DataKit?
                  </h3>
                  <ul className="text-xs text-white/70 space-y-2">
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-primary rounded-full"></div>
                      Access to DataKit Assistant with built-in credits
                    </li>

                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-primary rounded-full"></div>
                      Create unlimited projects
                    </li>

                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-primary rounded-full"></div>
                      Access to all cloud connections
                    </li>

                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-primary rounded-full"></div>
                      Export reports from data inspector
                    </li>

                    {/*
                    TODO:
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-primary rounded-full"></div>
                      Sync your settings and data across devices
                    </li> */}
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-primary rounded-full"></div>
                      Priority support and early access to new features
                    </li>
                    {/* 
                    TODO:
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-primary rounded-full"></div>
                      Usage analytics and insights dashboard
                    </li> */}
                  </ul>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;

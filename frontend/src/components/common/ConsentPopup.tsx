import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { usePostHog } from 'posthog-js/react';

interface ConsentPopupProps {
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}

const ConsentPopup: React.FC<ConsentPopupProps> = ({ onAccept, onDecline, onClose }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showThanks, setShowThanks] = useState(false);

  const handleAccept = () => {
    setShowThanks(true);
    
    // Close after showing thanks message for 2 seconds
    setTimeout(() => {
      onAccept();
    }, 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: 50, x: 20 }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 25,
        opacity: { duration: 0.3 }
      }}
      className="fixed bottom-4 right-4 z-50 max-w-xs will-change-transform"
      style={{ transform: 'translate3d(0, 0, 0)' }}
    >
      <div className="bg-popover border border-border rounded-lg shadow-2xl p-4">
        <AnimatePresence mode="wait">
          {showThanks ? (
            <motion.div
              key="thanks"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="text-center py-2"
            >
              <div className="flex items-center justify-center mb-2">
                <span className="text-popover-foreground font-medium text-sm">Thank you!</span>
              </div>
              <p className="text-muted-foreground text-xs">
                You help us make DataKit better for everyone.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="consent"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-sm text-popover-foreground">
                  Help us improve DataKit
                </h3>
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-popover-foreground transition-colors ml-2"
                >
                  <X className="w-3 h-3 cursor-pointer" />
                </button>
              </div>

              {/* Content */}
              <div className="mb-4">
                <p className="text-muted-foreground text-xs leading-relaxed mb-3">
                  We collect basic anonymous metrics to improve app stability. With your consent, we can enable enhanced analytics for better features. Your data files never leave the browser.
                </p>
                
                {/* Dropdown */}
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-popover-foreground transition-colors mb-2"
                >
                  <span>What do we collect?</span>
                  {isDropdownOpen ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
                
                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-accent/10 rounded p-3 mb-3">
                        <div className="space-y-2">
                          <div>
                            <p className="text-foreground text-xs font-medium mb-1">Basic (No Consent Needed):</p>
                            <ul className="text-muted-foreground text-xs space-y-0.5 pl-2">
                              <li>• Page views & navigation</li>
                              <li>• Performance metrics</li>
                              <li>• Error reports (to fix bugs)</li>
                              <li>• Session recordings (heavily masked)</li>
                            </ul>
                          </div>
                          
                          <div>
                            <p className="text-foreground text-xs font-medium mb-1">Advanced (With Consent):</p>
                            <ul className="text-muted-foreground text-xs space-y-0.5 pl-2">
                              <li>• Detailed feature usage</li>
                              <li>• Session recordings</li>
                              <li>• File types & sizes (not content)</li>
                              <li>• User journey tracking</li>
                            </ul>
                          </div>
                          
                          <div>
                            <p className="text-foreground text-xs font-medium mb-1">Never collected:</p>
                            <ul className="text-muted-foreground text-xs space-y-0.5 pl-2">
                              <li>• Your data files or content</li>
                              <li>• SQL queries you write</li>
                              <li>• Personal information</li>
                            </ul>
                          </div>
                        </div>
                        
                        <a
                          href="/privacy"
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline mt-2 block"
                        >
                          View full privacy policy
                        </a>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={onDecline}
                  className="flex-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/60 rounded transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={handleAccept}
                  className="flex-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors font-medium"
                >
                  Accept
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};


export const useConsentManager = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const posthog = usePostHog();

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('datakit-analytics-consent');
    
    if (consent !== null) {
      setHasInteracted(true);
      if (consent === 'true') {
        setAnalyticsEnabled(true);
        // Enable enhanced tracking if consent was previously given
        if (posthog) {
          posthog.set_config({
            autocapture: true,
            capture_pageview: true,
            // Less masking for consented users
            session_recording: {
              maskAllInputs: false,
              maskAllText: false,
              maskAllImages: false,
              blockAllMedia: false,
              maskTextSelector: '',
              maskInputOptions: {
                password: true, // Still mask passwords
                email: true, // Still mask emails for privacy
              },
            },
          });
          // Track enhanced pageview
          posthog.capture('$pageview', { tracking_level: 'enhanced' });
        }
      } else {
        // User declined - keep heavy masking
        if (posthog) {
          posthog.set_config({
            autocapture: false,
            capture_pageview: false,
            // Keep heavy masking for non-consented users
            session_recording: {
              maskAllInputs: true,
              maskAllText: true,
              maskAllImages: true,
              blockAllMedia: true,
              maskTextSelector: '*',
            },
          });
        }
      }
      return;
    }

    // For new users, track basic pageview immediately (no consent needed)
    if (posthog && !hasInteracted) {
      posthog.capture('$pageview', {
        tracking_level: 'basic',
      });
    }

    // Show popup after 3 seconds if no previous interaction
    const timer = setTimeout(() => {
      if (!hasInteracted) {
        setShowPopup(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasInteracted, posthog]);

  const handleAccept = () => {
    localStorage.setItem('datakit-analytics-consent', 'true');
    setAnalyticsEnabled(true);
    
    if (posthog) {
      // Enable enhanced tracking with less masking
      posthog.set_config({
        autocapture: true,
        capture_pageview: true,
        // Less masking for consented users
        session_recording: {
          maskAllInputs: false,
          maskAllText: false,
          maskAllImages: false,
          blockAllMedia: false,
          maskTextSelector: '',
          maskInputOptions: {
            password: true, // Still mask passwords
            email: true, // Still mask emails
          },
        },
      });
      
      // Track consent granted
      posthog.capture('consent_granted', {
        timestamp: new Date().toISOString(),
      });
      
      // Session recording already started, just less masked now
      
      // Track enhanced pageview
      posthog.capture('$pageview', { tracking_level: 'enhanced' });
    }
    
    setShowPopup(false);
    setHasInteracted(true);
  };

  const handleDecline = () => {
    localStorage.setItem('datakit-analytics-consent', 'false');
    setAnalyticsEnabled(false);
    
    if (posthog) {
      // Keep heavy masking for non-consented users
      posthog.set_config({
        autocapture: false,
        capture_pageview: false,
        // Keep heavy masking
        session_recording: {
          maskAllInputs: true,
          maskAllText: true,
          maskAllImages: true,
          blockAllMedia: true,
          maskTextSelector: '*',
        },
      });
      
      // Track consent declined (basic event)
      posthog.capture('consent_declined', {
        timestamp: new Date().toISOString(),
        tracking_level: 'basic',
      });
      
      // Session recording continues but heavily masked
    }
    
    setShowPopup(false);
    setHasInteracted(true);
  };

  const handleClose = () => {
    setShowPopup(false);
  };

  // Basic events that don't require consent
  const BASIC_EVENTS = [
    'app_loaded',
    'page_view', 
    'feature_accessed',
    'error_occurred',
    'performance_metric',
  ];

  // Utility function to track custom events (two-tiered)
  const trackEvent = useCallback((eventName: string, data?: Record<string, any>) => {
    if (!posthog) return;
    
    const isBasicEvent = BASIC_EVENTS.some(event => eventName.includes(event));
    
    if (isBasicEvent) {
      // Track basic events without consent
      posthog.capture(eventName, {
        ...data,
        tracking_level: 'basic',
        timestamp: new Date().toISOString(),
      });
    } else if (analyticsEnabled) {
      // Track enhanced events only with consent
      posthog.capture(eventName, {
        ...data,
        tracking_level: 'enhanced',
        timestamp: new Date().toISOString(),
      });
    }
  }, [posthog, analyticsEnabled]);

  // Utility function to track page views manually
  const trackPageview = useCallback((path?: string) => {
    if (!posthog) return;
    
    // Page views are basic events - always track
    posthog.capture('$pageview', {
      $current_url: path || window.location.href,
      tracking_level: analyticsEnabled ? 'enhanced' : 'basic',
    });
  }, [posthog, analyticsEnabled]);

  return {
    showPopup,
    analyticsEnabled,
    handleAccept,
    handleDecline,
    handleClose,
    trackEvent,
    trackPageview,
    ConsentPopup: () => (
      <AnimatePresence>
        {showPopup && (
          <ConsentPopup
            onAccept={handleAccept}
            onDecline={handleDecline}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    )
  };
};
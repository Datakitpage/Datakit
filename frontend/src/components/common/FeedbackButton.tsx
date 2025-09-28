import { FC } from 'react';
import { MessageSquare } from 'lucide-react';

import { Button } from '@/components/ui/Button';

import useFeedback from '@/hooks/feedback/useFeedback';

interface FeedbackButtonProps {
  /** Context to include with feedback */
  context?: string;
  /** Custom size for the button (defaults to 'sm') */
  size?: 'sm' | 'md' | 'lg';
  /** Custom variant for the button (defaults to 'ghost') */
  variant?: 'ghost' | 'primary' | 'secondary' | 'outline';
  /** Custom button text (defaults to 'Share Feedback') */
  text?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable feedback button component with modal
 * Compatible with Cloudflare Workers backend
 */
const FeedbackButton: FC<FeedbackButtonProps> = ({
  context,
  size = 'sm',
  variant = 'primary',
  text = 'Share Feedback?',
  className = '',
}) => {
  const {
    showFeedbackModal,
    feedbackEmail,
    feedbackMessage,
    isSubmitting,
    feedbackSuccess,
    feedbackError,
    openFeedbackModal,
    closeFeedbackModal,
    setFeedbackEmail,
    setFeedbackMessage,
    handleSubmitFeedback,
  } = useFeedback({
    context
  });

  return (
    <>
      {/* Feedback Button */}
      <Button
        variant={variant}
        size={size}
        onClick={openFeedbackModal}
        className={`flex items-center ${className}`}
      >
        <MessageSquare size={14} className="mr-1.5" />
        <span className="text-xs">{text}</span>
      </Button>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-background/60 flex items-center justify-center z-50">
          <div className="bg-popover p-4 rounded-lg shadow-lg w-96 border border-border">
            <h3 className="text-lg font-medium mb-4 text-foreground">Share Your Feedback</h3>

            {feedbackSuccess ? (
              <div className="bg-primary/10 border border-primary/30 rounded p-3 mb-4 text-foreground text-sm">
                <div className="flex items-center">
                  <div className="mr-2 bg-primary rounded-full p-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5"></path>
                    </svg>
                  </div>
                  <span>Thank you for your feedback!</span>
                </div>
              </div>
            ) : (
              <>
                {feedbackError && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded p-3 mb-4 text-destructive text-sm">
                    {feedbackError}
                  </div>
                )}

                <div className="mb-4">
                  <label
                    htmlFor="feedback-email"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Your Email (optional)
                  </label>
                  <input
                    id="feedback-email"
                    type="email"
                    value={feedbackEmail}
                    onChange={(e) => setFeedbackEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:border-primary text-sm text-foreground"
                  />
                </div>

                <div className="mb-4">
                  <label
                    htmlFor="feedback-message"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Your Feedback
                  </label>
                  <textarea
                    id="feedback-message"
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="Tell us what you think about DataKit..."
                    rows={4}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:border-primary text-sm text-foreground"
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeFeedbackModal}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSubmitFeedback}
                    disabled={isSubmitting}
                    className="min-w-[80px]"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>Sending...</span>
                      </div>
                    ) : (
                      'Submit'
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackButton;

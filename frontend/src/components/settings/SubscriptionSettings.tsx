import React, { useState } from 'react';
import { Check, Bell } from 'lucide-react';
import GlareHover from '@/components/ui/GlareHover';
import { useAuth } from '@/hooks/auth/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useNotifications } from '@/hooks/useNotifications';
import userService from '@/lib/api/userService';
import AnthropicLogo from '@/assets/anthropic.webp';

interface PricingCardProps {
  title: string;
  price: string | number;
  period?: string;
  description: string;
  features: string[];
  isCurrentPlan?: boolean;
  isPopular?: boolean;
  isComingSoon?: boolean;
  isEarlyAdopter?: boolean;
  icon?: React.ReactNode;
  onSelect?: () => void;
}

const PricingCard: React.FC<PricingCardProps> = ({
  title,
  price,
  period,
  description,
  features,
  isCurrentPlan = false,
  isComingSoon = false,
  isEarlyAdopter = false,
  icon,
  onSelect,
}) => {
  const cardContent = (
    <div className="h-full flex flex-col p-4 relative">
      {/* Compact Header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center mb-2">
          {icon && <div className="mr-2 text-primary">{icon}</div>}
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
        </div>
        <div className="mb-2">
          <span className="text-2xl font-bold text-foreground">
            {typeof price === 'string' ? price : `$${price}`}
          </span>
          {period && <span className="text-muted-foreground ml-1">/{period}</span>}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {/* Compact Features */}
      <div className="flex-1">
        <ul className="space-y-2">
          {features.slice(0, 4).map((feature, index) => (
            <li key={index} className="flex items-start">
              <Check className="h-3 w-3 text-primary mt-0.5 mr-2 flex-shrink-0" />
              <span className="text-xs text-foreground">{feature}</span>
            </li>
          ))}
          {features.length > 4 && (
            <li className="text-xs text-muted-foreground ml-5">
              +{features.length - 4} more features
            </li>
          )}
        </ul>

        {/* Free Plan Anthropic Message */}
        
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Floating badges - positioned outside the card */}
      {isEarlyAdopter && !isComingSoon && (
        <div className="absolute -top-4 -left-2 bg-gradient-to-r from-purple-600 to-pink-600 text-foreground text-xs font-medium px-3 py-1 rounded-full z-30 shadow-lg">
          Early Adopter: 20% OFF
        </div>
      )}

      {isComingSoon && title !== 'Pro' && (
        <div className="absolute -top-4 -right-2 bg-gradient-to-r from-sky-800 to-green-800 text-foreground text-xs font-medium px-3 py-1 rounded-full z-30 shadow-lg">
          Coming Soon
        </div>
      )}

      {/* Pro Plan Anthropic Badge */}
      {title === 'Pro' && isComingSoon && (
        <div className="absolute -top-4 -right-2 bg-gradient-to-r from-sky-600 via-sky-700 to-cyan-700 text-foreground text-xs font-medium px-3 py-1 rounded-full z-30 shadow-lg flex items-center gap-1">
          <img src={AnthropicLogo} className="h-3 w-3" alt="Anthropic" />
          <span>More credits soon!</span>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-primary to-primary/80 text-foreground text-xs font-medium px-4 py-1 rounded-full z-30 shadow-lg">
          Current Plan
        </div>
      )}

      <GlareHover
        width="100%"
        height="100%"
        background="linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)"
        borderRadius="12px"
        borderColor={
          isCurrentPlan
            ? 'rgba(var(--primary), 0.5)'
            : isEarlyAdopter
            ? 'rgba(168, 85, 247, 0.5)'
            : 'rgba(255,255,255,0.1)'
        }
        glareColor="#ffffff"
        glareOpacity={0.15}
        glareAngle={-30}
        glareSize={300}
        transitionDuration={800}
        className={`
          transition-all duration-300 hover:scale-[1.02] hover:shadow-xl
          ${isCurrentPlan ? 'shadow-lg shadow-primary/20' : ''}
          ${isComingSoon ? 'opacity-75' : ''}
          ${isEarlyAdopter ? 'shadow-lg shadow-purple-500/20' : ''}
          h-full
        `}
        style={{
          borderWidth: '1px',
          borderStyle: 'solid',
        }}
      >
        {cardContent}
      </GlareHover>
    </div>
  );
};

const SubscriptionSettings: React.FC = () => {
  const { user } = useAuth();
  const { creditsRemaining } = useCredits();
  const { showSuccess } = useNotifications();
  const [isWaitlistLoading, setIsWaitlistLoading] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);

  const currentPlan = user?.subscription?.planType || 'free';

  const plans = [
    {
      title: 'Free',
      price: 0,
      period: 'month',
      description: 'Perfect for getting started',
      features: [
        '315 credits per month',
        'Powered by Anthropic models',
        'Personal workspace',
        'Basic data analysis',
        'Community support',
      ],
      isCurrentPlan: currentPlan === 'free',
      icon: <></>,
    },
    {
      title: 'Pro',
      price: 19,
      period: 'month',
      description: 'With more Anthropic credits',
      features: [
        '1500 credits per month',
        'Advanced analytics',
        'Priority support',
        'More export capabilities',
        'Advanced integrations',
      ],
      isCurrentPlan: currentPlan === 'pro',
      isPopular: true,
      isComingSoon: true,
      icon: <img src={AnthropicLogo} className="h-4 w-4" alt="Anthropic" />,
    },
    {
      title: 'Team',
      price: 'Custom',
      description: 'For growing teams',
      features: [
        'Unlimited credits',
        'Team collaboration',
        'Multiple Workspaces',
        'Member management',
        'Premium support',
        'Custom integrations',
        'Advanced security',
        'Dedicated account manager',
      ],
      isCurrentPlan: currentPlan === 'team',
      isComingSoon: true,
      icon: <></>,
    },
  ];

  const handlePlanSelect = (planTitle: string) => {
    // Handle plan selection logic here
    console.log(`Selected plan: ${planTitle}`);
  };

  const handleWaitlistSignup = async (featureName: string) => {
    if (!user?.email && !waitlistEmail) {
      setShowEmailModal(true);
      return;
    }

    setIsWaitlistLoading(true);
    try {
      const email = user?.email || waitlistEmail;
      await userService.joinWaitlist(email, featureName);
      
      // Show success notification
      showSuccess(
        "You're on the waitlist!",
        `We'll let you know at ${email} when ${featureName} features roll out.`
      );
      
      // Reset modal state
      setShowEmailModal(false);
      setWaitlistEmail('');
    } catch (error) {
      console.error('Waitlist signup failed:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsWaitlistLoading(false);
    }
  };

  const handleEmailSubmit = () => {
    if (waitlistEmail) {
      handleWaitlistSignup('Pro');
    }
  };
console.log('creditsRemaining', creditsRemaining);
  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto">
      {/* Compact Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-1">
          Subscription Plans
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose the plan that fits your needs
        </p>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        {/* Left Column - Current Usage (Compact) */}
        <div className="lg:col-span-1 lg:mr-4">
          <div className="bg-gradient-to-br from-accent/5 to-accent/[0.02] border border-border rounded-xl p-4 h-full">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Current Usage
            </h3>
            <div className="space-y-4">
              <div className="bg-accent/5 border border-border rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-primary">
                  {creditsRemaining === -1 ? '∞' : Number(creditsRemaining).toFixed(2) || 0}
                </div>
                <div className="text-xs text-muted-foreground">Credits Remaining</div>
              </div>
              <div className="bg-accent/5 border border-border rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-foreground">
                  {user?.subscription?.planType?.toUpperCase() || 'FREE'}
                </div>
                <div className="text-xs text-muted-foreground">Current Plan</div>
              </div>
              <div className="bg-accent/5 border border-border rounded-lg p-3 text-center">
                <div className="text-sm font-bold text-foreground">
                  {user?.subscription?.creditsResetAt
                    ? new Date(
                        user.subscription.creditsResetAt
                      ).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">Next Reset</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Pricing Plans (Compact Grid) */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {plans.map((plan, index) => (
              <div key={index} className="flex flex-col">
                <PricingCard
                  title={plan.title}
                  price={plan.price}
                  period={plan.period}
                  description={plan.description}
                  features={plan.features}
                  isCurrentPlan={plan.isCurrentPlan}
                  isPopular={plan.isPopular}
                  isComingSoon={plan.isComingSoon}
                  isEarlyAdopter={plan.isEarlyAdopter}
                  icon={plan.icon}
                  onSelect={() => handlePlanSelect(plan.title)}
                />
                
                {/* Waitlist Button */}
                <div className="flex justify-center mt-4 pb-1">
                  {plan.isComingSoon ? (
                    <button
                      onClick={() => handleWaitlistSignup(plan.title)}
                      disabled={isWaitlistLoading}
                      className="group flex items-center gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 text-primary font-medium text-sm px-4 py-2 rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-50 shadow-sm hover:shadow-md"
                    >
                      <Bell className="h-4 w-4 group-hover:animate-pulse" />
                      {isWaitlistLoading ? 'Joining...' : 'Get notified'}
                    </button>
                  ) : (
                    <div className="h-10"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Email Modal for Anonymous Users */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-popover border border-border rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-foreground mb-4">Join Waitlist</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Enter your email to get notified when Pro features are released.
            </p>
            <input
              type="email"
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="w-full bg-accent/5 border border-border rounded-lg px-3 py-2 text-foreground text-sm mb-4 focus:outline-none focus:border-primary"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 bg-accent/5 border border-border text-foreground text-sm py-2 rounded-lg hover:bg-accent/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEmailSubmit}
                disabled={!waitlistEmail || isWaitlistLoading}
                className="flex-1 bg-primary text-foreground text-sm py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isWaitlistLoading ? 'Joining...' : 'Join Waitlist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionSettings;

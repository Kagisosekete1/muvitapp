import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Clock,
  DollarSign,
  Video,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Heart,
  Share2,
  MessageCircle,
  Trophy,
} from 'lucide-react';

interface CreatorOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Creator Program!',
    description: "Start your journey to monetization. Here's what you'll learn:",
    icon: Sparkles,
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10">
          <Users className="w-5 h-5 text-primary" />
          <span>Build your audience to 1,000 followers</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10">
          <Clock className="w-5 h-5 text-primary" />
          <span>Accumulate 4,000 watch hours</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10">
          <DollarSign className="w-5 h-5 text-primary" />
          <span>Start earning from your content</span>
        </div>
      </div>
    ),
  },
  {
    id: 'requirements',
    title: 'Monetization Requirements',
    description: "Here's what you need to qualify:",
    icon: Trophy,
    content: (
      <div className="space-y-6">
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold">1,000 Followers</h4>
              <p className="text-sm text-muted-foreground">Build a loyal community</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold">4,000 Watch Hours</h4>
              <p className="text-sm text-muted-foreground">In the last 12 months</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'create-content',
    title: 'Create Engaging Content',
    description: 'Tips for creating content that gets views:',
    icon: Video,
    content: (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <h4 className="font-medium">Post Consistently</h4>
            <p className="text-sm text-muted-foreground">Aim for at least 3-5 posts per week</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <h4 className="font-medium">Use Trending Sounds</h4>
            <p className="text-sm text-muted-foreground">Popular audio boosts discoverability</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <h4 className="font-medium">Hook Viewers Early</h4>
            <p className="text-sm text-muted-foreground">First 3 seconds are crucial</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <h4 className="font-medium">Use Hashtags</h4>
            <p className="text-sm text-muted-foreground">Help people discover your content</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'engagement',
    title: 'Boost Your Engagement',
    description: 'Engagement directly impacts your earnings:',
    icon: TrendingUp,
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border bg-card text-center">
            <Heart className="w-6 h-6 text-red-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Likes</p>
            <p className="text-sm font-semibold">+10%</p>
          </div>
          <div className="p-3 rounded-xl border bg-card text-center">
            <MessageCircle className="w-6 h-6 text-blue-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Comments</p>
            <p className="text-sm font-semibold">+25%</p>
          </div>
          <div className="p-3 rounded-xl border bg-card text-center">
            <Share2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Shares</p>
            <p className="text-sm font-semibold">+50%</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Higher engagement = higher earnings per view
        </p>
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
          <p className="text-sm text-center">
            <strong>Pro Tip:</strong> Respond to comments to build community and boost engagement!
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'earnings',
    title: 'How You Earn',
    description: 'Understanding your revenue:',
    icon: DollarSign,
    content: (
      <div className="space-y-4">
        <div className="p-4 rounded-xl border bg-card">
          <h4 className="font-semibold mb-2">Revenue Share: 55%</h4>
          <p className="text-sm text-muted-foreground">
            You keep 55% of all ad revenue generated from your content
          </p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <h4 className="font-semibold mb-2">Earnings Factors</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Watch time on your videos</li>
            <li>• Viewer engagement (likes, comments, shares)</li>
            <li>• Viewer location (different CPM rates)</li>
            <li>• Content category and quality</li>
          </ul>
        </div>
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-sm">
            💰 Minimum payout: $50 USD
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'complete',
    title: "You're All Set!",
    description: "You're ready to start your creator journey",
    icon: CheckCircle2,
    content: (
      <div className="text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h3 className="text-xl font-bold">Congratulations!</h3>
        <p className="text-muted-foreground">
          You've completed the creator onboarding. Now start creating amazing content and grow your audience!
        </p>
        <div className="grid grid-cols-2 gap-3 pt-4">
          <div className="p-3 rounded-xl border bg-card">
            <Video className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-sm font-medium">Create a Muv</p>
          </div>
          <div className="p-3 rounded-xl border bg-card">
            <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-sm font-medium">Track Progress</p>
          </div>
        </div>
      </div>
    ),
  },
];

const REQUIRED_FOLLOWERS = 2000;

const CreatorOnboardingModal: React.FC<CreatorOnboardingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { authUser, currentUser } = useUser();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  // Load existing onboarding progress and check follower count
  useEffect(() => {
    if (!authUser || !isOpen) return;

    const loadProgress = async () => {
      const { data } = await supabase
        .from('creator_onboarding')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (data) {
        setCurrentStep(data.current_step);
        setCompletedSteps(data.completed_steps || []);
      }
      
      // Get current follower count
      const followers = currentUser?.stats?.followers || 0;
      setFollowerCount(followers);
    };

    loadProgress();
  }, [authUser, isOpen, currentUser]);

  const saveProgress = async (step: number, completed: string[]) => {
    if (!authUser) return;

    const isComplete = step >= ONBOARDING_STEPS.length - 1;

    await supabase
      .from('creator_onboarding')
      .upsert({
        user_id: authUser.id,
        current_step: step,
        completed_steps: completed,
        is_completed: isComplete,
        completed_at: isComplete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });
  };

  const handleNext = async () => {
    const currentStepId = ONBOARDING_STEPS[currentStep].id;
    const newCompletedSteps = [...completedSteps, currentStepId];
    const nextStep = currentStep + 1;

    setCompletedSteps(newCompletedSteps);
    setCurrentStep(nextStep);

    await saveProgress(nextStep, newCompletedSteps);

    if (nextStep >= ONBOARDING_STEPS.length) {
      toast({
        title: 'Onboarding Complete!',
        description: 'Start creating content to begin your monetization journey.',
      });
      onClose();
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    
    // Mark all steps as complete
    const allStepIds = ONBOARDING_STEPS.map(s => s.id);
    await saveProgress(ONBOARDING_STEPS.length - 1, allStepIds);
    
    setIsLoading(false);
    onClose();
  };

  const step = ONBOARDING_STEPS[currentStep];
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const canActivate = followerCount >= REQUIRED_FOLLOWERS;
  const followersNeeded = Math.max(0, REQUIRED_FOLLOWERS - followerCount);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Show eligibility gate if user doesn't have enough followers */}
        {!canActivate ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <DialogTitle className="text-lg">Creator Journey</DialogTitle>
              </div>
            </DialogHeader>
            <div className="py-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Users className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Keep Growing!</h3>
                <p className="text-muted-foreground text-sm">
                  You need at least <strong>{REQUIRED_FOLLOWERS.toLocaleString()}</strong> followers to start your creator journey.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-secondary/50">
                <p className="text-sm text-muted-foreground mb-2">Your current followers</p>
                <p className="text-3xl font-bold text-primary">{followerCount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {followersNeeded.toLocaleString()} more to go!
                </p>
              </div>
              <Progress value={(followerCount / REQUIRED_FOLLOWERS) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Keep creating great content and engaging with your audience to grow your following!
              </p>
            </div>
            <div className="pt-4 border-t">
              <Button onClick={onClose} className="w-full">
                Got it!
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {step && React.createElement(step.icon, { className: 'w-5 h-5 text-primary' })}
                  <DialogTitle className="text-lg">{step?.title}</DialogTitle>
                </div>
                <span className="text-sm text-muted-foreground">
                  {currentStep + 1}/{ONBOARDING_STEPS.length}
                </span>
              </div>
              <Progress value={progress} className="h-1" />
            </DialogHeader>

            <div className="py-4">
              {step?.description && (
                <p className="text-muted-foreground mb-4">{step.description}</p>
              )}
              {step?.content}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              {!isLastStep && (
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Skip
                </Button>
              )}
              <Button
                onClick={isLastStep ? onClose : handleNext}
                className="flex-1"
              >
                {isLastStep ? 'Get Started' : 'Continue'}
                {!isLastStep && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreatorOnboardingModal;

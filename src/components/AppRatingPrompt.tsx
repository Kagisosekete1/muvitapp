import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Star, X, Heart, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';

interface AppRatingPromptProps {
  reelsViewedThisSession: number;
}

const REELS_THRESHOLD = 10; // Show after viewing 10 reels
const MONTHS_BETWEEN_PROMPTS = 4;

const AppRatingPrompt: React.FC<AppRatingPromptProps> = ({ reelsViewedThisSession }) => {
  const { authUser } = useUser();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (authUser && reelsViewedThisSession >= REELS_THRESHOLD && !hasChecked) {
      checkIfShouldShow();
    }
  }, [authUser, reelsViewedThisSession, hasChecked]);

  const checkIfShouldShow = async () => {
    setHasChecked(true);
    if (!authUser) return;

    const { data } = await supabase
      .from('app_ratings')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (!data) {
      // First time - create record and show prompt
      await supabase.from('app_ratings').insert({
        user_id: authUser.id,
        reels_viewed_count: reelsViewedThisSession,
      });
      setIsOpen(true);
      return;
    }

    if (data.has_rated) {
      // Already rated, don't show again
      return;
    }

    // Check if enough time has passed since last prompt
    if (data.last_prompted_at) {
      const lastPrompted = new Date(data.last_prompted_at);
      const now = new Date();
      const monthsDiff = (now.getFullYear() - lastPrompted.getFullYear()) * 12 + 
                         (now.getMonth() - lastPrompted.getMonth());
      
      if (monthsDiff < MONTHS_BETWEEN_PROMPTS) {
        return; // Too soon to show again
      }
    }

    // Update and show prompt
    await supabase
      .from('app_ratings')
      .update({
        reels_viewed_count: (data.reels_viewed_count || 0) + reelsViewedThisSession,
        last_prompted_at: new Date().toISOString(),
      })
      .eq('user_id', authUser.id);

    setIsOpen(true);
  };

  const handleSubmitRating = async () => {
    if (!authUser || rating === 0) return;

    await supabase
      .from('app_ratings')
      .update({
        has_rated: true,
        rating: rating,
        last_prompted_at: new Date().toISOString(),
      })
      .eq('user_id', authUser.id);

    setIsOpen(false);

    if (rating >= 4) {
      // Good rating - prompt to rate on store
      if (Capacitor.isNativePlatform()) {
        toast({
          title: 'Thank you! 🎉',
          description: 'Would you mind rating us on the app store?',
        });
        // In a real app, this would open the native store rating dialog
      } else {
        toast({
          title: 'Thank you! 🎉',
          description: 'We appreciate your feedback!',
        });
      }
    } else {
      // Lower rating - thank them and offer feedback option
      toast({
        title: 'Thanks for your feedback',
        description: "We're always working to improve!",
      });
    }
  };

  const handleMaybeLater = async () => {
    if (!authUser) return;

    await supabase
      .from('app_ratings')
      .update({
        last_prompted_at: new Date().toISOString(),
      })
      .eq('user_id', authUser.id);

    setIsOpen(false);
  };

  const handleNeverAsk = async () => {
    if (!authUser) return;

    await supabase
      .from('app_ratings')
      .update({
        has_rated: true, // Mark as rated to never show again
      })
      .eq('user_id', authUser.id);

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[350px] rounded-3xl p-0 overflow-hidden border-none">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-6 text-center relative">
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex justify-center mb-3">
            <div className="relative">
              <Heart className="w-16 h-16 text-primary fill-primary" />
              <Sparkles className="w-6 h-6 text-yellow-500 absolute -top-1 -right-1" />
            </div>
          </div>
          
          <h2 className="text-xl font-bold text-foreground mb-1">Enjoying Muv'it?</h2>
          <p className="text-sm text-muted-foreground">
            Your feedback helps us make the app better!
          </p>
        </div>

        {/* Rating Stars */}
        <div className="p-6 space-y-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    star <= (hoveredRating || rating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Submit Button */}
          <Button 
            onClick={handleSubmitRating}
            className="w-full rounded-xl"
            disabled={rating === 0}
          >
            Submit Rating
          </Button>

          {/* Secondary Actions */}
          <div className="flex gap-2 text-sm">
            <Button 
              variant="ghost" 
              onClick={handleMaybeLater}
              className="flex-1 text-muted-foreground"
            >
              Maybe Later
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleNeverAsk}
              className="flex-1 text-muted-foreground"
            >
              Don't Ask Again
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppRatingPrompt;

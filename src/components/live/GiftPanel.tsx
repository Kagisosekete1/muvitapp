import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Gift, Coins, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface GiftDefinition {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  animation: 'bounce' | 'spin' | 'pulse' | 'shake';
}

/**
 * Server-validated catalog is the ONLY source of truth for gift prices.
 * This client-side array is retained as an empty placeholder for typing;
 * it must NEVER be used to render gifts.
 */
export const GIFTS: GiftDefinition[] = [];

interface GiftPanelProps {
  isOpen: boolean;
  onClose: () => void;
  coinBalance: number;
  onSendGift: (gift: GiftDefinition) => void;
}

const GiftPanel: React.FC<GiftPanelProps> = ({ isOpen, onClose, coinBalance, onSendGift }) => {
  const [catalog, setCatalog] = useState<GiftDefinition[] | null>(null);
  const [selectedGift, setSelectedGift] = useState<GiftDefinition | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isOpen || catalog) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('gift_catalog')
        .select('id, name, emoji, cost, animation')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      if (error || !data) {
        setCatalog([]);
        return;
      }
      setCatalog(data as GiftDefinition[]);
    })();
    return () => { cancelled = true; };
  }, [isOpen, catalog]);

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-28 left-0 right-0 z-30 animate-fade-in">
      <div className="mx-2 bg-black/90 backdrop-blur-lg rounded-2xl border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-pink-400" />
            <span className="text-white text-sm font-semibold">Send a Gift</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-1 rounded-full">
              <Coins className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-400 text-xs font-semibold">{coinBalance}</span>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {catalog === null ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
          </div>
        ) : catalog.length === 0 ? (
          <div className="py-6 text-center text-white/60 text-xs">
            Gifts are unavailable right now.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {catalog.map(gift => (
                <button
                  key={gift.id}
                  onClick={() => setSelectedGift(gift)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                    selectedGift?.id === gift.id
                      ? 'bg-pink-500/30 border border-pink-500/50 scale-105'
                      : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  } ${coinBalance < gift.cost ? 'opacity-40' : ''}`}
                  disabled={coinBalance < gift.cost}
                >
                  <span className="text-2xl">{gift.emoji}</span>
                  <span className="text-white text-[10px]">{gift.name}</span>
                  <div className="flex items-center gap-0.5">
                    <Coins className="w-2.5 h-2.5 text-yellow-400" />
                    <span className="text-yellow-400 text-[10px]">{gift.cost}</span>
                  </div>
                </button>
              ))}
            </div>

            {selectedGift && (
              <Button
                className="w-full bg-pink-500 hover:bg-pink-600 text-white rounded-full"
                onClick={async () => {
                  setSending(true);
                  try {
                    await onSendGift(selectedGift);
                    setSelectedGift(null);
                  } finally {
                    setSending(false);
                  }
                }}
                disabled={sending || coinBalance < selectedGift.cost}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>Send {selectedGift.emoji} {selectedGift.name} ({selectedGift.cost} coins)</>
                )}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GiftPanel;

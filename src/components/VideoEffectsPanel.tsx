import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Gauge, 
  Sparkles, 
  Wand2, 
  Star, 
  Heart, 
  Flame,
  Snowflake,
  Sun,
  Moon,
  Zap,
  Crown,
  Glasses,
  Cat,
  Dog,
  Rabbit,
  PartyPopper,
  Check
} from 'lucide-react';

export interface VideoEffects {
  speed: number;
  transition: string;
  arFilter: string;
  filter: string;
}

interface VideoEffectsPanelProps {
  effects: VideoEffects;
  onEffectsChange: (effects: VideoEffects) => void;
  onApply: () => void;
}

const SPEED_OPTIONS = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
];

const TRANSITIONS = [
  { id: 'none', name: 'None', icon: '✨', preview: '' },
  { id: 'fade', name: 'Fade', icon: '🌫️', preview: 'opacity 0.5s ease-in-out' },
  { id: 'zoom', name: 'Zoom', icon: '🔍', preview: 'scale(1.1)' },
  { id: 'slide', name: 'Slide', icon: '➡️', preview: 'translateX(10px)' },
  { id: 'rotate', name: 'Rotate', icon: '🔄', preview: 'rotate(5deg)' },
  { id: 'blur', name: 'Blur', icon: '💨', preview: 'blur(2px)' },
  { id: 'flash', name: 'Flash', icon: '⚡', preview: 'brightness(1.5)' },
  { id: 'glitch', name: 'Glitch', icon: '📺', preview: 'hue-rotate(90deg)' },
];

const AR_FILTERS = [
  { id: 'none', name: 'None', icon: Sparkles, color: 'text-muted-foreground' },
  { id: 'hearts', name: 'Hearts', icon: Heart, color: 'text-red-500' },
  { id: 'stars', name: 'Stars', icon: Star, color: 'text-yellow-500' },
  { id: 'fire', name: 'Fire', icon: Flame, color: 'text-orange-500' },
  { id: 'snow', name: 'Snow', icon: Snowflake, color: 'text-blue-400' },
  { id: 'sun', name: 'Sunny', icon: Sun, color: 'text-yellow-400' },
  { id: 'moon', name: 'Moon', icon: Moon, color: 'text-purple-400' },
  { id: 'lightning', name: 'Electric', icon: Zap, color: 'text-yellow-300' },
  { id: 'crown', name: 'Crown', icon: Crown, color: 'text-amber-500' },
  { id: 'glasses', name: 'Cool', icon: Glasses, color: 'text-blue-500' },
  { id: 'cat', name: 'Cat', icon: Cat, color: 'text-orange-400' },
  { id: 'dog', name: 'Dog', icon: Dog, color: 'text-amber-600' },
  { id: 'bunny', name: 'Bunny', icon: Rabbit, color: 'text-pink-400' },
  { id: 'party', name: 'Party', icon: PartyPopper, color: 'text-purple-500' },
];

const FILTERS = [
  { id: 'none', name: 'None', class: '', preview: '✨' },
  { id: 'warm', name: 'Warm', class: 'sepia(30%) saturate(140%)', preview: '🌅' },
  { id: 'cool', name: 'Cool', class: 'hue-rotate(180deg) saturate(80%)', preview: '❄️' },
  { id: 'vintage', name: 'Vintage', class: 'sepia(50%) contrast(90%)', preview: '📷' },
  { id: 'bw', name: 'B&W', class: 'grayscale(100%)', preview: '🖤' },
  { id: 'vivid', name: 'Vivid', class: 'saturate(200%) contrast(110%)', preview: '🌈' },
  { id: 'fade', name: 'Fade', class: 'brightness(110%) contrast(90%) saturate(80%)', preview: '🌫️' },
  { id: 'drama', name: 'Drama', class: 'contrast(130%) brightness(90%)', preview: '🎭' },
  { id: 'glow', name: 'Glow', class: 'brightness(115%) saturate(120%)', preview: '💫' },
  { id: 'noir', name: 'Noir', class: 'grayscale(80%) contrast(120%)', preview: '🎬' },
  { id: 'sunset', name: 'Sunset', class: 'sepia(20%) hue-rotate(-10deg) saturate(130%)', preview: '🌇' },
  { id: 'neon', name: 'Neon', class: 'saturate(180%) brightness(105%) hue-rotate(10deg)', preview: '💜' },
  { id: 'cyberpunk', name: 'Cyber', class: 'hue-rotate(280deg) saturate(150%) contrast(110%)', preview: '🤖' },
  { id: 'dreamy', name: 'Dreamy', class: 'brightness(105%) saturate(90%) blur(0.5px)', preview: '💭' },
  { id: 'retro', name: 'Retro', class: 'sepia(40%) saturate(120%) hue-rotate(-20deg)', preview: '📼' },
  { id: 'pop', name: 'Pop Art', class: 'saturate(250%) contrast(120%)', preview: '🎨' },
];

const VideoEffectsPanel: React.FC<VideoEffectsPanelProps> = ({
  effects,
  onEffectsChange,
  onApply,
}) => {
  const [activeTab, setActiveTab] = useState('speed');

  const handleSpeedChange = (value: number[]) => {
    const speed = SPEED_OPTIONS.reduce((prev, curr) =>
      Math.abs(curr.value - value[0]) < Math.abs(prev.value - value[0]) ? curr : prev
    ).value;
    onEffectsChange({ ...effects, speed });
  };

  return (
    <div className="space-y-4 py-2">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4 rounded-xl bg-secondary/50">
          <TabsTrigger value="speed" className="rounded-lg text-xs">
            <Gauge className="w-3 h-3 mr-1" />
            Speed
          </TabsTrigger>
          <TabsTrigger value="transitions" className="rounded-lg text-xs">
            <Wand2 className="w-3 h-3 mr-1" />
            Trans
          </TabsTrigger>
          <TabsTrigger value="ar" className="rounded-lg text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            AR
          </TabsTrigger>
          <TabsTrigger value="filters" className="rounded-lg text-xs">
            <Star className="w-3 h-3 mr-1" />
            Filter
          </TabsTrigger>
        </TabsList>

        {/* Speed Controls */}
        <TabsContent value="speed" className="mt-4 space-y-4">
          <div className="text-center">
            <span className="text-2xl font-bold text-primary">{effects.speed}x</span>
            <p className="text-xs text-muted-foreground">Playback Speed</p>
          </div>
          
          <Slider
            value={[effects.speed]}
            min={0.25}
            max={3}
            step={0.25}
            onValueChange={handleSpeedChange}
            className="w-full"
          />
          
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            <span>Slow</span>
            <span>Normal</span>
            <span>Fast</span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {SPEED_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={effects.speed === option.value ? 'default' : 'outline'}
                size="sm"
                className="text-xs px-1 h-8 rounded-lg"
                onClick={() => onEffectsChange({ ...effects, speed: option.value })}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </TabsContent>

        {/* Transitions */}
        <TabsContent value="transitions" className="mt-4">
          <div className="grid grid-cols-4 gap-2">
            {TRANSITIONS.map((transition) => (
              <Button
                key={transition.id}
                variant={effects.transition === transition.id ? 'default' : 'outline'}
                className={`flex flex-col items-center p-3 h-auto rounded-xl ${
                  effects.transition === transition.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => onEffectsChange({ ...effects, transition: transition.id })}
              >
                <span className="text-xl mb-1">{transition.icon}</span>
                <span className="text-xs">{transition.name}</span>
              </Button>
            ))}
          </div>
        </TabsContent>

        {/* AR Filters */}
        <TabsContent value="ar" className="mt-4">
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
            {AR_FILTERS.map((filter) => {
              const Icon = filter.icon;
              return (
                <Button
                  key={filter.id}
                  variant={effects.arFilter === filter.id ? 'default' : 'outline'}
                  className={`flex flex-col items-center p-3 h-auto rounded-xl ${
                    effects.arFilter === filter.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => onEffectsChange({ ...effects, arFilter: filter.id })}
                >
                  <Icon className={`w-5 h-5 mb-1 ${filter.color}`} />
                  <span className="text-xs">{filter.name}</span>
                </Button>
              );
            })}
          </div>
        </TabsContent>

        {/* Visual Filters */}
        <TabsContent value="filters" className="mt-4">
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
            {FILTERS.map((filter) => (
              <Button
                key={filter.id}
                variant={effects.filter === filter.id ? 'default' : 'outline'}
                className={`flex flex-col items-center p-2 h-auto rounded-xl ${
                  effects.filter === filter.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => onEffectsChange({ ...effects, filter: filter.id })}
              >
                <span className="text-lg mb-1">{filter.preview}</span>
                <span className="text-xs">{filter.name}</span>
              </Button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Button className="w-full rounded-xl" onClick={onApply}>
        <Check className="w-4 h-4 mr-2" />
        Apply Effects
      </Button>
    </div>
  );
};

export default VideoEffectsPanel;
export { FILTERS, AR_FILTERS, TRANSITIONS, SPEED_OPTIONS };

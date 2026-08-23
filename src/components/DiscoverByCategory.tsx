import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Hash, ChevronRight, Music, Flame, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CategoryData {
  name: string;
  hashtags: string[];
  icon: React.ReactNode;
  color: string;
  count: number;
}

const DANCE_CATEGORIES: Omit<CategoryData, 'count'>[] = [
  {
    name: 'Hip-Hop',
    hashtags: ['hiphop', 'hiphopmusic', 'hiphopdance', 'hiphopculture', 'rap', 'breakdance', 'bboy', 'bgirl', 'popping', 'locking'],
    icon: <Flame className="w-5 h-5" />,
    color: 'from-orange-500 to-red-500',
  },
  {
    name: 'Contemporary',
    hashtags: ['contemporary', 'contemporarydance', 'moderndance', 'lyrical', 'ballet', 'jazz', 'fluidity', 'expressive'],
    icon: <Sparkles className="w-5 h-5" />,
    color: 'from-purple-500 to-pink-500',
  },
  {
    name: 'Afrobeats',
    hashtags: ['afrobeats', 'afrodance', 'afrofusion', 'azonto', 'gwaragwara', 'shaku', 'zanku', 'legwork', 'amapiano'],
    icon: <Music className="w-5 h-5" />,
    color: 'from-green-500 to-emerald-500',
  },
  {
    name: 'Latin',
    hashtags: ['salsa', 'bachata', 'reggaeton', 'merengue', 'cumbia', 'latin', 'latindance', 'kizomba', 'zouk', 'samba'],
    icon: <Flame className="w-5 h-5" />,
    color: 'from-yellow-500 to-orange-500',
  },
  {
    name: 'K-Pop',
    hashtags: ['kpop', 'kpopdance', 'kpopcover', 'bts', 'blackpink', 'choreography', 'kdance', 'koreanpop'],
    icon: <Sparkles className="w-5 h-5" />,
    color: 'from-pink-500 to-rose-500',
  },
  {
    name: 'Street Dance',
    hashtags: ['streetdance', 'krump', 'waacking', 'voguing', 'house', 'housedance', 'freestyle', 'battles', 'cypher'],
    icon: <Flame className="w-5 h-5" />,
    color: 'from-slate-600 to-zinc-700',
  },
  {
    name: 'Dancehall',
    hashtags: ['dancehall', 'dancehallmusic', 'jamaican', 'caribbean', 'soca', 'whine', 'duttywhine'],
    icon: <Music className="w-5 h-5" />,
    color: 'from-lime-500 to-green-600',
  },
  {
    name: 'Bollywood',
    hashtags: ['bollywood', 'bollywooddance', 'indiandance', 'desi', 'bharatanatyam', 'classical', 'fusion'],
    icon: <Sparkles className="w-5 h-5" />,
    color: 'from-amber-500 to-yellow-600',
  },
];

const DiscoverByCategory: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategoryCounts();
  }, []);

  const fetchCategoryCounts = async () => {
    try {
      const { data: reelsData } = await supabase
        .from('reels')
        .select('id, title, description')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (reelsData) {
        const categoriesWithCounts = DANCE_CATEGORIES.map(category => {
          let count = 0;
          reelsData.forEach(reel => {
            const text = `${reel.title || ''} ${reel.description || ''}`.toLowerCase();
            const hasMatch = category.hashtags.some(tag => 
              text.includes(`#${tag}`) || text.includes(tag)
            );
            if (hasMatch) count++;
          });
          return { ...category, count };
        });

        // Sort by count descending
        categoriesWithCounts.sort((a, b) => b.count - a.count);
        setCategories(categoriesWithCounts);
      }
    } catch (error) {
      console.error('Error fetching category counts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (category: CategoryData) => {
    // Navigate to search with the first hashtag of the category
    const mainTag = category.hashtags[0];
    navigate(`/search?hashtag=${encodeURIComponent(mainTag)}`);
  };

  const formatCount = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading) {
    return (
      <div className="px-4 mb-6">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Hash className="w-5 h-5 text-primary" />
          Discover by Category
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-secondary/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Hash className="w-5 h-5 text-primary" />
          Discover by Category
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {categories.slice(0, 8).map((category) => (
          <button
            key={category.name}
            onClick={() => handleCategoryClick(category)}
            className={`relative p-4 rounded-xl bg-gradient-to-br ${category.color} text-white overflow-hidden transition-transform active:scale-95`}
          >
            <div className="absolute top-2 right-2 opacity-30">
              {category.icon}
            </div>
            <div className="flex flex-col items-start">
              <span className="font-bold text-sm">{category.name}</span>
              <span className="text-xs opacity-80">
                {formatCount(category.count)} Muv'z
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Related hashtags scroll */}
      <div className="mt-4">
        <p className="text-xs text-muted-foreground mb-2">Trending dance hashtags</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {categories.slice(0, 4).flatMap(cat => cat.hashtags.slice(0, 2)).map((tag, idx) => (
            <Button
              key={`${tag}-${idx}`}
              variant="secondary"
              size="sm"
              className="rounded-full text-xs whitespace-nowrap"
              onClick={() => navigate(`/search?hashtag=${encodeURIComponent(tag)}`)}
            >
              #{tag}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DiscoverByCategory;

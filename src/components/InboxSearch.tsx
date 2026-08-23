import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, ArrowLeft } from 'lucide-react';

interface InboxSearchProps {
  isOpen: boolean;
  onClose: () => void;
  searchType: 'messages' | 'notifications';
  onSearch: (query: string) => void;
}

const InboxSearch: React.FC<InboxSearchProps> = ({ isOpen, onClose, searchType, onSearch }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    onSearch(value);
  }, [onSearch]);

  if (!isOpen) return null;

  return (
    <div className="flex items-center gap-2 px-4 mb-4">
      <Button variant="ghost" size="icon" onClick={onClose}>
        <ArrowLeft className="w-5 h-5" />
      </Button>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={searchType === 'messages' ? 'Search messages...' : 'Search notifications...'}
          className="pl-9 pr-9 rounded-full"
          autoFocus
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => handleSearch('')}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default InboxSearch;

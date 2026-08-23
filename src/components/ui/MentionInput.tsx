import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface ProfileSuggestion {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onSubmit?: () => void;
  as?: 'input' | 'textarea';
  rows?: number;
  autoFocus?: boolean;
}

/**
 * Reusable input/textarea that detects "@" and shows a username autocomplete.
 * Selecting a result inserts "@username " at the caret.
 */
const MentionInput = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, MentionInputProps>(
  ({ value, onChange, placeholder, className, disabled, onSubmit, as = 'input', rows = 1, autoFocus }, ref) => {
    const innerRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [query, setQuery] = useState<string | null>(null);
    const tokenStart = useRef<number>(-1);

    const setRef = (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<any>).current = el;
    };

    // Detect mention token at caret
    const detectMention = useCallback((text: string, caret: number) => {
      const before = text.slice(0, caret);
      const match = before.match(/(?:^|\s)@([A-Za-z0-9_.]{0,20})$/);
      if (match) {
        tokenStart.current = caret - match[1].length - 1; // position of "@"
        setQuery(match[1]);
        setOpen(true);
      } else {
        tokenStart.current = -1;
        setQuery(null);
        setOpen(false);
      }
    }, []);

    useEffect(() => {
      if (query === null) {
        setSuggestions([]);
        return;
      }
      let cancelled = false;
      const run = async () => {
        const q = query.trim();
        const builder = supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_url')
          .order('username', { ascending: true })
          .limit(6);
        const { data } = q.length === 0
          ? await builder
          : await builder.ilike('username', `${q}%`);
        if (!cancelled) {
          setSuggestions((data || []) as ProfileSuggestion[]);
          setActiveIndex(0);
        }
      };
      const t = setTimeout(run, 120);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }, [query]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value;
      onChange(v);
      const caret = e.target.selectionStart ?? v.length;
      detectMention(v, caret);
    };

    const insertMention = (username: string) => {
      const el = innerRef.current;
      if (!el || tokenStart.current < 0) return;
      const caret = el.selectionStart ?? value.length;
      const before = value.slice(0, tokenStart.current);
      const after = value.slice(caret);
      const inserted = `@${username} `;
      const next = before + inserted + after;
      onChange(next);
      setOpen(false);
      setQuery(null);
      tokenStart.current = -1;
      requestAnimationFrame(() => {
        const pos = (before + inserted).length;
        try {
          el.focus();
          el.setSelectionRange(pos, pos);
        } catch {}
      });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (open && suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % suggestions.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          insertMention(suggestions[activeIndex].username);
          return;
        }
        if (e.key === 'Escape') {
          setOpen(false);
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey && as === 'input') {
        e.preventDefault();
        onSubmit?.();
      }
    };

    const commonProps = {
      ref: setRef as any,
      value,
      onChange: handleChange,
      onKeyDown: handleKeyDown,
      placeholder,
      disabled,
      autoFocus,
      className: className,
    };

    return (
      <div className="relative flex-1">
        {as === 'textarea' ? (
          <textarea {...(commonProps as any)} rows={rows} />
        ) : (
          <input {...(commonProps as any)} type="text" />
        )}
        {open && suggestions.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 right-0 z-50 bg-popover border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={s.user_id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(s.username);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                  i === activeIndex ? 'bg-accent' : ''
                }`}
              >
                <Avatar className="w-7 h-7">
                  <AvatarImage src={s.avatar_url || ''} />
                  <AvatarFallback className="text-[10px]">
                    {s.display_name?.[0] || s.username?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">@{s.username}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.display_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

MentionInput.displayName = 'MentionInput';

export default MentionInput;

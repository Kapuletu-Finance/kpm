'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, FolderKanban, CheckSquare, Video, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDebounce } from '@/hooks/useDebounce'; 

type SearchResult = {
  type: 'Project' | 'Feature' | 'Meeting' | 'Member';
  id: string;
  title: string;
  subtitle: string;
  url: string;
  avatar_url?: string;
};

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: results, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: async (): Promise<SearchResult[]> => {
      if (debouncedQuery.length < 2) return [];
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (url: string) => {
    setIsOpen(false);
    setQuery('');
    router.push(url);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Project': return <FolderKanban className="w-4 h-4 text-primary" />;
      case 'Feature': return <CheckSquare className="w-4 h-4 text-blue-500" />;
      case 'Meeting': return <Video className="w-4 h-4 text-purple-500" />;
      case 'Member': return <Users className="w-4 h-4 text-orange-500" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  return (
    <div className="relative flex flex-1 w-full max-w-md" ref={searchRef}>
      <div className="relative w-full">
        <Search
          className="pointer-events-none absolute inset-y-0 left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          className="block w-full rounded-md border border-border bg-muted/50 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          placeholder="Search projects, features, or members... (Press '/' to focus)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
      </div>

      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover text-popover-foreground rounded-lg shadow-xl border border-border overflow-hidden z-50">
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : results && results.length > 0 ? (
            <div className="max-h-80 overflow-y-auto py-2">
              {results.map((result, idx) => (
                <button
                  key={`${result.type}-${result.id}-${idx}`}
                  onClick={() => handleSelect(result.url)}
                  className="w-full text-left flex items-start gap-3 px-4 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {result.type === 'Member' ? (
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={result.avatar_url || ''} />
                        <AvatarFallback className="text-[10px]">{result.title[0]}</AvatarFallback>
                      </Avatar>
                    ) : (
                      getIcon(result.type)
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate text-foreground">{result.title}</span>
                    <span className="text-xs text-muted-foreground truncate">{result.subtitle}</span>
                  </div>
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {result.type}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found for &quot;{query}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, FileText, Hash } from "lucide-react";
import { search, initializeSearch, SearchResult } from "@/lib/search";
import { useRouter } from "next/navigation";

export default function LocalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    initializeSearch();
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (query.length >= 2) {
        setIsSearching(true);
        try {
          const searchResults = await search(query);
          setResults(searchResults);
          setSelectedIndex(0);
        } catch (error) {
          console.error('Search error:', error);
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
        setIsSearching(false);
      }
    };

    const debounceTimeout = setTimeout(performSearch, 150);
    return () => clearTimeout(debounceTimeout);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleResultClick = (href: string) => {
    router.push(href);
    setIsOpen(false);
    setQuery("");
  };

  const handleKeyNavigation = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleResultClick(results[selectedIndex].href);
    }
  };

  if (!isOpen) {
    return (
      <div className="relative border rounded-lg sm:w-fit w-[68%]">
        <div className="absolute right-2 top-[0.4rem] hidden items-center gap-0.5 text-xs font-code sm:flex pointer-events-none">
          <div className="bg-background/30 border rounded-md py-0.5 px-1 dark:border-neutral-700 border-neutral-300">
            Ctrl
          </div>
          <div className="bg-background/30 border rounded-md py-0.5 px-[0.28rem] dark:border-neutral-700 border-neutral-300">
            K
          </div>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search documentation...</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-lg mx-auto p-4">
        <div className="bg-background border rounded-lg shadow-lg">
          <div className="flex items-center gap-2 p-3 border-b">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyNavigation}
              placeholder="Search documentation..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-muted rounded-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {isSearching && (
            <div className="p-6 text-center text-muted-foreground">
              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              Searching...
            </div>
          )}
          
          {!isSearching && results.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              {results.map((result, index) => {
                const getMatchIcon = () => {
                  switch (result.matchType) {
                    case 'content':
                      return <FileText className="w-3 h-3 text-muted-foreground" />;
                    case 'heading':
                      return <Hash className="w-3 h-3 text-muted-foreground" />;
                    default:
                      return null;
                  }
                };

                return (
                  <button
                    key={`${result.href}-${index}`}
                    onClick={() => handleResultClick(result.href)}
                    className={`w-full text-left p-3 hover:bg-muted transition-colors ${
                      index === selectedIndex ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm">{result.title}</div>
                          {getMatchIcon()}
                        </div>
                        
                        {result.description && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {result.description}
                          </div>
                        )}
                        
                        {result.matchedHeading && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            In: {result.matchedHeading}
                          </div>
                        )}
                        
                        <div className="text-xs text-muted-foreground mt-1">
                          {result.href}
                        </div>
                      </div>
                      
                      {result.tag && (
                        <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded shrink-0">
                          {result.tag}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          
          {!isSearching && query.length >= 2 && results.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              No results found for &quot;{query}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
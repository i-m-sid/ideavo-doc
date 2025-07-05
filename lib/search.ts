import Fuse, { type FuseResult } from "fuse.js";

export interface ContentItem {
  title: string;
  description: string;
  href: string;
  content: string;
  tag?: string;
  headings: {
    level: number;
    text: string;
    anchor: string;
  }[];
}

export interface SearchResult {
  title: string;
  href: string;
  content?: string;
  description?: string;
  tag?: string;
  headings?: {
    level: number;
    text: string;
    anchor: string;
  }[];
  matchType?: 'title' | 'content' | 'heading' | 'description';
  matchedHeading?: string;
}

// Enhanced Fuse.js configuration for full-text search
const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'description', weight: 0.3 },
    { name: 'content', weight: 0.2 },
    { name: 'headings.text', weight: 0.1 }
  ],
  threshold: 0.4,
  includeMatches: true,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
  findAllMatches: true
};

// Lightweight search for initial fast results
const lightweightFuseOptions = {
  keys: [
    { name: 'title', weight: 0.7 },
    { name: 'tag', weight: 0.3 }
  ],
  threshold: 0.3,
  includeMatches: true,
  includeScore: true,
  minMatchCharLength: 2
};

let fullTextFuse: Fuse<ContentItem>;
let lightweightFuse: Fuse<{ title: string; href: string; tag?: string }>;
let isFullIndexLoaded = false;

// Load search index from pre-built JSON files
async function loadSearchIndex(filename: string) {
  try {
    const response = await fetch(`/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error loading search index ${filename}:`, error);
    return null;
  }
}

// Initialize lightweight search immediately
export const initializeLightweightSearch = async () => {
  const lightweightIndex = await loadSearchIndex('search-index-lightweight.json');
  if (lightweightIndex) {
    lightweightFuse = new Fuse(lightweightIndex, lightweightFuseOptions);
  }
  return lightweightFuse;
};

// Initialize full-text search (async)
export const initializeFullTextSearch = async () => {
  try {
    const fullIndex = await loadSearchIndex('search-index.json');
    if (fullIndex) {
      fullTextFuse = new Fuse(fullIndex, fuseOptions);
      isFullIndexLoaded = true;
      console.log('Full-text search index loaded');
    }
  } catch (error) {
    console.error('Failed to load full-text search index:', error);
  }
};

// Convert fuse results to SearchResult format
function convertToSearchResults(fuseResults: FuseResult<ContentItem | { title: string; href: string; tag?: string }>[]): SearchResult[] {
  return fuseResults.map(result => {
    const item = result.item;
    const matches = result.matches || [];
    
    // Determine match type based on which field was matched
    let matchType: SearchResult['matchType'] = 'title';
    let matchedHeading: string | undefined;
    
    for (const match of matches) {
      if (match.key === 'content') {
        matchType = 'content';
        break;
      } else if (match.key === 'description') {
        matchType = 'description';
        break;
      } else if (match.key === 'headings.text') {
        matchType = 'heading';
        matchedHeading = match.value;
        break;
      }
    }
    
    return {
      title: item.title,
      href: item.href,
      content: 'content' in item ? item.content : undefined,
      description: 'description' in item ? item.description : undefined,
      tag: item.tag,
      headings: 'headings' in item ? item.headings : undefined,
      matchType,
      matchedHeading
    };
  });
}

// Main search function with fallback
export const search = async (query: string): Promise<SearchResult[]> => {
  if (!query || query.length < 2) {
    return [];
  }
  
  // If full-text search is available, use it
  if (isFullIndexLoaded && fullTextFuse) {
    const results = fullTextFuse.search(query);
    return convertToSearchResults(results.slice(0, 10));
  }
  
  // Fallback to lightweight search
  if (!lightweightFuse) {
    await initializeLightweightSearch();
  }
  
  const results = lightweightFuse.search(query);
  return convertToSearchResults(results.slice(0, 8));
};

// Get search suggestions (lightweight, fast)
export const getSearchSuggestions = async (query: string): Promise<string[]> => {
  if (!query || query.length < 1) {
    return [];
  }
  
  if (!lightweightFuse) {
    await initializeLightweightSearch();
  }
  
  const results = lightweightFuse.search(query);
  return results.slice(0, 5).map(result => result.item.title);
};

// Initialize search on module load
let initPromise: Promise<void> | null = null;

export const initializeSearch = () => {
  if (!initPromise) {
    initPromise = (async () => {
      // Initialize lightweight search first for immediate availability
      await initializeLightweightSearch();
      // Then initialize full-text search in the background
      initializeFullTextSearch();
    })();
  }
  return initPromise;
};
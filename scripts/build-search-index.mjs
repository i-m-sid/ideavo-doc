#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import matter from "gray-matter";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes config - we'll read it as a file since we can't import from TypeScript
async function getRoutes() {
  const routesPath = path.join(__dirname, '../lib/routes-config.ts');
  const routesContent = await fs.readFile(routesPath, 'utf-8');
  
  // Extract the ROUTES array using regex with better pattern
  const routesMatch = routesContent.match(/export const ROUTES: EachRoute\[\] = (\[[\s\S]*?\n\]);/);
  if (!routesMatch) {
    throw new Error('Could not find ROUTES in routes-config.ts');
  }
  
  // Use eval to parse the routes (in build environment this is safe)
  const routesCode = routesMatch[1];
  // Replace TypeScript specific syntax that would break eval
  const cleanRoutesCode = routesCode
    .replace(/as const/g, '')
    .replace(/:\s*string/g, '')
    .replace(/:\s*boolean/g, '')
    .replace(/:\s*true/g, ': true')
    .replace(/noLink\?/g, 'noLink');
  
  try {
    return eval(cleanRoutesCode);
  } catch (error) {
    console.error('Error parsing routes:', error);
    console.error('Routes code:', cleanRoutesCode);
    throw error;
  }
}

// Strip MDX/JSX components to get plain text
function stripMdxToText(content) {
  return content
    // Remove frontmatter (if any remains)
    .replace(/^---[\s\S]*?---\n?/m, '')
    // Remove JSX components (opening and closing tags)
    .replace(/<[^>]*>/g, ' ')
    // Remove code blocks but keep content
    .replace(/```[\s\S]*?```/g, (match) => {
      const lines = match.split('\n');
      return lines.slice(1, -1).join(' '); // Remove first and last line (```)
    })
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove markdown bold/italic
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Clean up multiple spaces and newlines
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract headings from MDX content
function extractHeadings(content) {
  const headingsRegex = /^(#{2,4})\s(.+)$/gm;
  const headings = [];
  let match;
  
  while ((match = headingsRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const anchor = text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    headings.push({
      level,
      text,
      anchor
    });
  }
  
  return headings;
}

// Get content path from slug
function getDocsContentPath(slug) {
  return path.join(__dirname, "../contents/docs/", `${slug}/index.mdx`);
}

// Index a single content file
async function indexContentFile(route) {
  try {
    if (route.noLink || !route.href) {
      return null;
    }

    // Convert route href to file path
    const slug = route.href.replace(/^\//, ''); // Remove leading slash
    const contentPath = getDocsContentPath(slug);
    
    // Check if file exists
    try {
      await fs.access(contentPath);
    } catch {
      console.warn(`Content file not found: ${contentPath}`);
      return null;
    }

    const rawMdx = await fs.readFile(contentPath, "utf-8");
    const { data: frontmatter, content } = matter(rawMdx);
    
    const plainTextContent = stripMdxToText(content);
    const headings = extractHeadings(content);

    return {
      title: frontmatter.title || route.title,
      description: frontmatter.description || '',
      href: `/docs${route.href}`,
      content: plainTextContent,
      tag: route.tag,
      headings
    };
  } catch (error) {
    console.error(`Error indexing content for ${route.href}:`, error);
    return null;
  }
}

// Recursively extract all routes with proper path building
function extractAllRoutes(routes, basePath = '') {
  const allRoutes = [];
  
  for (const route of routes) {
    const fullPath = basePath + route.href;
    
    if (!route.noLink && route.href) {
      allRoutes.push({
        ...route,
        href: fullPath
      });
    }
    
    if (route.items) {
      allRoutes.push(...extractAllRoutes(route.items, fullPath));
    }
  }
  
  return allRoutes;
}

// Create full content index
async function createContentIndex() {
  const routes = await getRoutes();
  const allRoutes = extractAllRoutes(routes);
  const contentItems = [];
  
  console.log(`Indexing ${allRoutes.length} content files...`);
  
  // Process files in batches to avoid overwhelming the system
  const batchSize = 5;
  for (let i = 0; i < allRoutes.length; i += batchSize) {
    const batch = allRoutes.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(route => indexContentFile(route))
    );
    
    batchResults.forEach(item => {
      if (item) {
        contentItems.push(item);
      }
    });
  }
  
  console.log(`Successfully indexed ${contentItems.length} content files`);
  return contentItems;
}

// Create a lightweight index for faster initial loading
async function createLightweightIndex() {
  const routes = await getRoutes();
  const allRoutes = extractAllRoutes(routes);
  
  return allRoutes.map(route => ({
    title: route.title,
    href: `/docs${route.href}`,
    tag: route.tag
  }));
}

// Main build function
async function buildSearchIndex() {
  try {
    console.log('Building search index...');
    
    // Create both indexes
    const [fullIndex, lightweightIndex] = await Promise.all([
      createContentIndex(),
      createLightweightIndex()
    ]);
    
    // Write indexes to public directory
    const publicDir = path.join(__dirname, '../public');
    await fs.mkdir(publicDir, { recursive: true });
    
    await Promise.all([
      fs.writeFile(
        path.join(publicDir, 'search-index.json'),
        JSON.stringify(fullIndex, null, 2)
      ),
      fs.writeFile(
        path.join(publicDir, 'search-index-lightweight.json'),
        JSON.stringify(lightweightIndex, null, 2)
      )
    ]);
    
    console.log('✅ Search index built successfully!');
    console.log(`📊 Full index: ${fullIndex.length} items`);
    console.log(`📊 Lightweight index: ${lightweightIndex.length} items`);
    
  } catch (error) {
    console.error('❌ Failed to build search index:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildSearchIndex();
}

export { buildSearchIndex };
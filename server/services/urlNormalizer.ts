/**
 * Normalize URLs to ensure they have proper protocol
 */
export function normalizeUrl(url: string): string {
  if (!url) return url;
  
  // If URL already has protocol, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If URL starts with //, add https:
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  
  // Otherwise, add https://
  return `https://${url}`;
}

/**
 * Validate if a URL is properly formatted
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(normalizeUrl(url));
    return true;
  } catch {
    return false;
  }
}


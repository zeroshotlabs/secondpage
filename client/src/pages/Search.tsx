import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Search as SearchIcon, ExternalLink, TrendingUp, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  sourceEngine: string;
  originalPosition: number;
  originalPage: number;
  finalScore: number;
  appearances: number;
}

type EngineName = 'google' | 'bing' | 'duckduckgo' | 'brave';

interface EngineConfig {
  engine: EngineName;
  pages: number[];
}

const ENGINE_META: { engine: EngineName; label: string; color: string }[] = [
  { engine: 'google', label: 'Google', color: 'text-blue-600' },
  { engine: 'bing', label: 'Bing', color: 'text-orange-600' },
  { engine: 'duckduckgo', label: 'DuckDuckGo', color: 'text-green-600' },
  { engine: 'brave', label: 'Brave', color: 'text-red-600' },
];

export default function Search() {
  const [query, setQuery] = useState("");
  const [engineConfigs, setEngineConfigs] = useState<EngineConfig[]>(
    ENGINE_META.map(({ engine }) => ({ engine, pages: [2, 3] }))
  );
  const [results, setResults] = useState<SearchResult[]>([]);
  const [duplicates, setDuplicates] = useState<SearchResult[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [searchInfo, setSearchInfo] = useState<{
    totalResults: number;
    uniqueResults: number;
    cached: boolean;
  } | null>(null);

  const searchMutation = trpc.search.execute.useMutation({
    onSuccess: (data: any) => {
      setResults(data.results);
      setDuplicates(data.duplicates || []);
      setShowDuplicates(false);
      setSearchInfo({
        totalResults: data.totalResults,
        uniqueResults: data.uniqueResults,
        cached: data.cached,
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    // Filter to only enabled engines (those with at least one page)
    const activeConfigs = engineConfigs.filter(config => config.pages.length > 0);
    
    if (activeConfigs.length === 0) return;

    searchMutation.mutate({
      query: query.trim(),
      engineConfigs: activeConfigs,
    });
  };

  const toggleEnginePage = (engine: EngineName, page: number) => {
    setEngineConfigs(prev => 
      prev.map(config => {
        if (config.engine === engine) {
          const pages = config.pages.includes(page)
            ? config.pages.filter(p => p !== page)
            : [...config.pages, page].sort((a, b) => a - b);
          return { ...config, pages };
        }
        return config;
      })
    );
  };

  const isEnginePageSelected = (engine: EngineName, page: number) => {
    const config = engineConfigs.find(c => c.engine === engine);
    return config?.pages.includes(page) || false;
  };

  const getEnginePages = (engine: EngineName) => {
    const config = engineConfigs.find(c => c.engine === engine);
    return config?.pages || [];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="container py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
            SecondPage.ai
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover hidden gems from search results beyond the first page. 
            Aggregate, rank, and explore quality content that others miss.
          </p>
        </div>

        {/* Search Form */}
        <Card className="max-w-4xl mx-auto mb-8 shadow-lg border-purple-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SearchIcon className="h-5 w-5 text-primary" />
              Search Configuration
            </CardTitle>
            <CardDescription>
              Enter your search query and select which pages to aggregate from each engine
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-6">
              {/* Query Input */}
              <div className="space-y-2">
                <Label htmlFor="query">Search Query</Label>
                <Input
                  id="query"
                  type="text"
                  placeholder="Enter your search query..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="text-lg"
                  disabled={searchMutation.isPending}
                />
              </div>

              {/* Engine Configuration */}
              <div className="space-y-4">
                <Label>Search Engines & Pages</Label>
                
                {ENGINE_META.map(({ engine, label, color }) => (
                  <div key={engine} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={`font-medium ${color}`}>{label}</div>
                      <div className="text-sm text-muted-foreground">
                        {getEnginePages(engine).length > 0
                          ? `Pages: ${getEnginePages(engine).join(", ")}`
                          : "No pages selected"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(page => (
                        <Button
                          key={page}
                          type="button"
                          variant={isEnginePageSelected(engine, page) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleEnginePage(engine, page)}
                          disabled={searchMutation.isPending}
                          className="w-12"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={
                  searchMutation.isPending || 
                  !query.trim() || 
                  engineConfigs.every(c => c.pages.length === 0)
                }
              >
                {searchMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <SearchIcon className="mr-2 h-5 w-5" />
                    Search SecondPage
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error Message */}
        {searchMutation.isError && (
          <Alert variant="destructive" className="max-w-4xl mx-auto mb-8">
            <AlertDescription>
              {searchMutation.error.message || "An error occurred while searching. Please try again."}
            </AlertDescription>
          </Alert>
        )}

        {/* Search Info */}
        {searchInfo && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>
                  Found <strong className="text-foreground">{searchInfo.uniqueResults}</strong> unique results
                </span>
                {duplicates.length > 0 && (
                  <button
                    onClick={() => setShowDuplicates(!showDuplicates)}
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    {showDuplicates
                      ? `hide ${duplicates.length} duplicates`
                      : `${searchInfo.totalResults} total — show all`}
                  </button>
                )}
                {duplicates.length === 0 && searchInfo.totalResults > searchInfo.uniqueResults && (
                  <span className="text-xs">
                    ({searchInfo.totalResults} total before deduplication)
                  </span>
                )}
              </div>
              {searchInfo.cached && (
                <Badge variant="secondary" className="text-xs">
                  Cached
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="max-w-4xl mx-auto space-y-4">
            {results.map((result, index) => {
              let hostname = '';
              try { hostname = new URL(result.url).hostname; } catch (_) { hostname = result.url; }
              return (
                <Card key={`unique-${index}`} className="hover:shadow-md transition-shadow border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="group">
                          <CardTitle className="text-xl mb-1 group-hover:text-primary transition-colors line-clamp-2">
                            {result.title}
                          </CardTitle>
                        </a>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{hostname}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">Score: {result.finalScore}</Badge>
                        {result.appearances > 1 && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {result.appearances}x
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{result.snippet}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-xs capitalize">{result.sourceEngine}</Badge>
                      <span>Page {result.originalPage}</span>
                      <span>Position {result.originalPosition}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Duplicate results (grayed out) */}
            {showDuplicates && duplicates.length > 0 && (
              <>
                <div className="border-t pt-4 mt-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    {duplicates.length} duplicate {duplicates.length === 1 ? 'result' : 'results'} (same content found on multiple engines)
                  </p>
                </div>
                {duplicates.map((result, index) => {
                  let hostname = '';
                  try { hostname = new URL(result.url).hostname; } catch (_) { hostname = result.url; }
                  return (
                    <Card key={`dup-${index}`} className="transition-shadow border-l-4 border-l-muted opacity-50">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <a href={result.url} target="_blank" rel="noopener noreferrer" className="group">
                              <CardTitle className="text-xl mb-1 text-muted-foreground line-clamp-2">
                                {result.title}
                              </CardTitle>
                            </a>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="truncate">{hostname}</span>
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs text-muted-foreground">Duplicate</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{result.snippet}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-xs capitalize">{result.sourceEngine}</Badge>
                          <span>Page {result.originalPage}</span>
                          <span>Position {result.originalPosition}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Empty State */}
        {!searchMutation.isPending && results.length === 0 && searchInfo === null && (
          <div className="max-w-4xl mx-auto text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <SearchIcon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Ready to discover hidden gems?</h3>
            <p className="text-muted-foreground">
              Enter a search query and select which pages to aggregate from each search engine
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Search, ExternalLink, TrendingUp, Loader2, ChevronDown, ChevronUp, Lock, Check, AlertTriangle, Clock, History } from "lucide-react";
import { Link } from "wouter";

type EngineName = 'google' | 'bing' | 'duckduckgo' | 'brave';

interface EngineConfig {
  engine: EngineName;
  pages: number[];
}

interface RawResult {
  title: string;
  url: string;
  snippet: string;
  page: number;
  position: number;
  engine: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  sourceEngine: string;
  originalPosition: number;
  originalPage: number;
  finalScore: number;
  appearances: number;
  isDuplicate?: boolean;
  duplicateOf?: string;
}

const ENGINE_COLORS: Record<string, { hex: string; tw: string; twBg: string; twBorder: string; twLight: string }> = {
  bing:       { hex: '#f97316', tw: 'text-orange-400', twBg: 'bg-orange-500', twBorder: 'border-l-orange-500', twLight: 'bg-orange-500/10' },
  duckduckgo: { hex: '#22c55e', tw: 'text-green-400',  twBg: 'bg-green-500',  twBorder: 'border-l-green-500',  twLight: 'bg-green-500/10' },
  brave:      { hex: '#ef4444', tw: 'text-red-400',    twBg: 'bg-red-500',    twBorder: 'border-l-red-500',    twLight: 'bg-red-500/10' },
  google:     { hex: '#3b82f6', tw: 'text-blue-400',   twBg: 'bg-blue-500',   twBorder: 'border-l-blue-500',   twLight: 'bg-blue-500/10' },
};

const ENGINE_META: { engine: EngineName; label: string; needsKey?: string }[] = [
  { engine: 'bing', label: 'Bing' },
  { engine: 'duckduckgo', label: 'DuckDuckGo' },
  { engine: 'brave', label: 'Brave', needsKey: 'BRAVE_API_KEY' },
  { engine: 'google', label: 'Google', needsKey: 'GOOGLE_API_KEY' },
];

type EngineStatus = 'idle' | 'scraping' | 'done' | 'error';

interface EngineState {
  status: EngineStatus;
  results: RawResult[];
  error?: string;
  startedAt?: number;
  durationMs?: number;
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Animated number counter
function Counter({ value, className = '' }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (value === display) return;
    const start = ref.current;
    const diff = value - start;
    const duration = 500;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      setDisplay(current);
      ref.current = current;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  return <span className={`tabular-nums font-mono ${className}`}>{display}</span>;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [engineConfigs, setEngineConfigs] = useState<EngineConfig[]>(
    ENGINE_META.map(({ engine }) => ({ engine, pages: [2, 3] }))
  );
  const [configExpanded, setConfigExpanded] = useState(true);
  const [searchPhase, setSearchPhase] = useState<'idle' | 'scraping' | 'ranking' | 'done'>('idle');
  const [engineStates, setEngineStates] = useState<Record<string, EngineState>>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [duplicates, setDuplicates] = useState<SearchResult[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);

  const [showHistory, setShowHistory] = useState(false);

  const engineStatusQuery = trpc.search.engineStatus.useQuery();
  const engineStatus = engineStatusQuery.data || {} as Record<string, boolean>;

  const historyQuery = trpc.search.history.useQuery({ limit: 10 });
  const utils = trpc.useUtils();

  const scrapeEngineMut = trpc.search.scrapeEngine.useMutation();
  const rankAndSaveMut = trpc.search.rankAndSave.useMutation();

  const isEngineAvailable = (engine: EngineName) => {
    if (!engineStatusQuery.data) return true;
    return engineStatus[engine] !== false;
  };

  const toggleEnginePage = (engine: string, page: number) => {
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

  const getEnginePages = (engine: string) => {
    return engineConfigs.find(c => c.engine === engine)?.pages || [];
  };

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const activeConfigs = engineConfigs.filter(
      c => c.pages.length > 0 && isEngineAvailable(c.engine)
    );
    if (activeConfigs.length === 0) return;

    // Reset state
    setSearchPhase('scraping');
    setConfigExpanded(false);
    setResults([]);
    setDuplicates([]);
    setShowDuplicates(false);
    setTotalResults(0);
    setVisibleCount(0);

    const initialStates: Record<string, EngineState> = {};
    activeConfigs.forEach(c => { initialStates[c.engine] = { status: 'scraping', results: [] }; });
    setEngineStates(initialStates);

    // Scrape each engine in parallel with timing
    const allRawResults: RawResult[] = [];
    const engineTimings: { engine: string; durationMs: number; success: boolean; resultCount: number; errorMessage?: string | null }[] = [];
    const promises = activeConfigs.map(async (config) => {
      const startTime = Date.now();
      try {
        const results = await scrapeEngineMut.mutateAsync({
          query: query.trim(),
          engine: config.engine,
          pages: config.pages,
        });
        const durationMs = Date.now() - startTime;
        engineTimings.push({ engine: config.engine, durationMs, success: true, resultCount: results.length });
        setEngineStates(prev => ({
          ...prev,
          [config.engine]: { status: 'done', results, durationMs },
        }));
        return results;
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        engineTimings.push({ engine: config.engine, durationMs, success: false, resultCount: 0, errorMessage: err.message });
        setEngineStates(prev => ({
          ...prev,
          [config.engine]: { status: 'error', results: [], error: err.message, durationMs },
        }));
        return [];
      }
    });

    const resultArrays = await Promise.all(promises);
    resultArrays.forEach(arr => allRawResults.push(...arr));

    if (allRawResults.length === 0) {
      setSearchPhase('done');
      return;
    }

    // Rank and save (with engine timings)
    setSearchPhase('ranking');
    try {
      const response = await rankAndSaveMut.mutateAsync({
        query: query.trim(),
        engineConfigs: activeConfigs,
        rawResults: allRawResults,
        engineTimings,
      });

      setResults(response.results);
      setDuplicates(response.duplicates);
      setTotalResults(response.totalResults);
      setSearchPhase('done');
      utils.search.history.invalidate();

      // Staggered reveal
      setVisibleCount(0);
      const total = response.results.length;
      let count = 0;
      const reveal = () => {
        count = Math.min(count + 3, total);
        setVisibleCount(count);
        if (count < total) requestAnimationFrame(reveal);
      };
      requestAnimationFrame(reveal);
    } catch (err: any) {
      console.error('rankAndSave failed:', err);
      setSearchPhase('done');
    }
  }, [query, engineConfigs, engineStatus]);

  // Group duplicates under their parent
  const normalizeUrl = (url: string) => {
    try {
      const u = new URL(url);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']
        .forEach(p => u.searchParams.delete(p));
      const h = u.hostname.replace(/^www\./, '');
      const p = u.pathname.replace(/\/$/, '') || '/';
      return `${u.protocol}//${h}${p}${u.search}`;
    } catch { return url; }
  };

  const getDupesForResult = (result: SearchResult) => {
    const normUrl = normalizeUrl(result.url);
    return duplicates.filter(d => d.duplicateOf === normUrl);
  };

  const isSearching = searchPhase === 'scraping' || searchPhase === 'ranking';

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f1629 0%, #1a1f3a 50%, #0f1629 100%)' }}>
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute w-96 h-96 rounded-full blur-3xl" style={{ background: '#dc354520', top: '10%', right: '20%', animation: 'blobFloat 20s ease-in-out infinite' }} />
        <div className="absolute w-96 h-96 rounded-full blur-3xl" style={{ background: '#3b82f620', bottom: '10%', left: '10%', animation: 'blobFloat 25s ease-in-out 5s infinite reverse' }} />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/10 backdrop-blur-md sticky top-0 z-20" style={{ background: '#0f162990' }}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
                <img src="/favicon.png" alt="secondpage.ai" width="30" height="30" />
                <span className="text-lg font-semibold text-white/90">secondpage.ai</span>
              </div>
            </Link>
            <Link href="/about">
              <button className="text-white/50 hover:text-white/80 text-sm transition-colors">About</button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative container mx-auto px-4 py-6 max-w-5xl">
        {/* Hero - only when idle */}
        {searchPhase === 'idle' && results.length === 0 && (
          <div className="text-center py-16 animate-in fade-in duration-500">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Search Beyond<br />
              <span style={{ color: '#dc3545' }}>the SEO</span>
            </h1>
            <p className="text-white/50 max-w-xl mx-auto text-lg">
              Aggregate results from multiple search engines, beyond the algo's first page
              that's stuffed with the search engine's own ads.
            </p>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-6">
          <form onSubmit={handleSearch}>
            <div className="flex gap-2 rounded-xl p-1" style={{ background: '#ffffff08', border: '1px solid #ffffff15' }}>
              <input
                type="text"
                placeholder="What are you searching for?"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                disabled={isSearching}
                className="flex-1 bg-transparent text-white placeholder-white/30 text-lg px-4 py-3 outline-none"
              />
              {historyQuery.data && historyQuery.data.length > 0 && !isSearching && (
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="px-2 text-white/20 hover:text-white/50 transition-colors"
                  title="Search history"
                >
                  <History className="h-4 w-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="px-5 py-3 rounded-lg font-medium text-white transition-all disabled:opacity-30"
                style={{ background: isSearching ? '#ffffff10' : 'linear-gradient(135deg, #dc3545, #3b5fc7)' }}
                title={isSearching ? 'Search in progress...' : 'Search across selected engines and pages'}
              >
                {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              </button>
            </div>
          </form>

          {/* History dropdown */}
          {showHistory && historyQuery.data && historyQuery.data.length > 0 && !isSearching && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-30 max-h-64 overflow-y-auto" style={{ background: '#1a1f3ae8', border: '1px solid #ffffff15', backdropFilter: 'blur(12px)' }}>
              <div className="px-3 py-1.5 text-[10px] text-white/20 uppercase tracking-wider border-b border-white/5">Recent searches</div>
              {historyQuery.data.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setQuery(item.query); setShowHistory(false); }}
                  className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center gap-3 transition-colors"
                >
                  <Clock className="h-3 w-3 text-white/20 flex-shrink-0" />
                  <span className="text-white/60 text-sm truncate flex-1">{item.query}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(item.engines as string[]).map(eng => {
                      const c = ENGINE_COLORS[eng];
                      return c ? <div key={eng} className="w-1.5 h-1.5 rounded-full" style={{ background: c.hex }} title={eng} /> : null;
                    })}
                  </div>
                  <span className="text-white/15 text-[10px] flex-shrink-0">{timeAgo(item.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Engine Config */}
        <div className="mb-6 rounded-xl overflow-hidden" style={{ background: '#ffffff06', border: '1px solid #ffffff10' }}>
          {/* Summary bar */}
          <button
            type="button"
            onClick={() => setConfigExpanded(!configExpanded)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-3 flex-wrap">
              {ENGINE_META.map(({ engine, label }) => {
                const c = ENGINE_COLORS[engine];
                const available = isEngineAvailable(engine);
                const pages = getEnginePages(engine);
                const state = engineStates[engine];

                return (
                  <div key={engine} className={`flex items-center gap-1.5 ${available ? '' : 'opacity-30'}`} title={available ? `${label}: ${pages.length > 0 ? `pages ${pages.join(', ')}` : 'no pages selected'}` : `${label}: API key required`}>
                    <div className={`w-2 h-2 rounded-full ${c.twBg}`} title={`${label} engine indicator`} />
                    <span className={`font-medium ${c.tw}`}>{label}</span>
                    {!available && <Lock className="h-3 w-3 text-white/30" title={`${label} requires an API key to use`} />}
                    {available && state?.status === 'scraping' && (
                      <Loader2 className="h-3 w-3 animate-spin text-white/40" title={`Fetching results from ${label}...`} />
                    )}
                    {available && state?.status === 'done' && (
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded-full" style={{ background: c.hex + '20', color: c.hex }} title={`${state.results.length} raw results fetched from ${label}`}>
                        {state.results.length}
                      </span>
                    )}
                    {available && state?.status === 'error' && (
                      <AlertTriangle className="h-3 w-3 text-yellow-400" title={`${label} returned an error: ${state.error || 'unknown'}`} />
                    )}
                    {available && !state && pages.length > 0 && (
                      <span className="text-xs text-white/30" title={`Will search pages ${pages.join(', ')}`}>p{pages.join(',')}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-1 text-white/40">
              <span className="text-xs">{configExpanded ? 'Hide' : 'Configure'}</span>
              {configExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </div>
          </button>

          {configExpanded && (
            <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
              {ENGINE_META.map(({ engine, label, needsKey }) => {
                const c = ENGINE_COLORS[engine];
                const available = isEngineAvailable(engine);

                if (!available) {
                  return (
                    <div key={engine} className="flex items-center gap-3 px-3 py-2 rounded-lg opacity-30" style={{ background: '#ffffff05' }} title={`${label} is unavailable — set ${needsKey} environment variable to enable`}>
                      <div className={`w-2 h-2 rounded-full ${c.twBg}`} />
                      <Lock className="h-3 w-3 text-white/40" />
                      <span className="text-white/40 text-sm">{label}</span>
                      <span className="text-white/20 text-xs ml-auto">API key needed</span>
                    </div>
                  );
                }

                const pages = getEnginePages(engine);
                return (
                  <div key={engine} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: c.hex + '08', border: `1px solid ${c.hex}15` }}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.twBg}`} />
                    <span className={`text-sm font-medium ${c.tw} w-24 flex-shrink-0`}>{label}</span>
                    <div className="flex gap-1 flex-wrap flex-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(page => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => toggleEnginePage(engine, page)}
                          disabled={isSearching}
                          title={pages.includes(page) ? `Remove page ${page} from ${label} search` : `Add page ${page} to ${label} search`}
                          className={`w-8 h-7 rounded text-xs font-medium transition-all ${
                            pages.includes(page)
                              ? 'text-white shadow-sm'
                              : 'text-white/20 hover:text-white/40'
                          }`}
                          style={pages.includes(page) ? { background: c.hex + '60' } : { background: '#ffffff05' }}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-white/20 flex-shrink-0 w-12 text-right" title={pages.length > 0 ? `${pages.length} page${pages.length > 1 ? 's' : ''} selected for ${label}` : `${label} disabled — no pages selected`}>
                      {pages.length > 0 ? `${pages.length}pg` : 'off'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Processing View */}
        {(searchPhase === 'scraping' || searchPhase === 'ranking') && (
          <div className="mb-8 space-y-3">
            {Object.entries(engineStates).map(([engine, state]) => {
              const c = ENGINE_COLORS[engine] || ENGINE_COLORS.bing;
              const meta = ENGINE_META.find(m => m.engine === engine);

              return (
                <div key={engine} className="rounded-xl overflow-hidden" style={{ background: '#ffffff06', border: `1px solid ${c.hex}20` }}>
                  {/* Engine header */}
                  <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: `1px solid ${c.hex}10` }}>
                    <div className={`w-2.5 h-2.5 rounded-full ${c.twBg} ${state.status === 'scraping' ? 'animate-pulse' : ''}`} />
                    <span className={`font-medium text-sm ${c.tw}`}>{meta?.label || engine}</span>
                    <div className="flex-1" />
                    {state.status === 'scraping' && (
                      <div className="flex items-center gap-2" title={`Scraping ${meta?.label || engine}...`}>
                        <div className="h-1 w-24 rounded-full overflow-hidden" style={{ background: c.hex + '20' }}>
                          <div className="h-full rounded-full" style={{ background: c.hex, animation: 'progressSweep 2s ease-in-out infinite' }} />
                        </div>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: c.hex }} />
                      </div>
                    )}
                    {state.status === 'done' && (
                      <div className="flex items-center gap-2" title={`${state.results.length} raw results fetched from ${meta?.label || engine}`}>
                        <span className="text-xs font-mono" style={{ color: c.hex, animation: 'fadeSlideUp 0.3s ease-out both' }}>
                          {state.results.length} results
                        </span>
                        <Check className="h-3.5 w-3.5" style={{ color: c.hex, animation: 'scaleIn 0.3s ease-out both' }} />
                      </div>
                    )}
                    {state.status === 'error' && (
                      <div className="flex items-center gap-2" title={`${meta?.label || engine} failed: ${state.error || 'request blocked or timed out'}`}>
                        <span className="text-xs text-yellow-400">blocked</span>
                        <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                      </div>
                    )}
                  </div>

                  {/* Live result titles */}
                  {state.results.length > 0 && (
                    <div className="px-4 py-2 space-y-0.5 max-h-32 overflow-hidden">
                      {state.results.slice(0, 8).map((r, i) => (
                        <div
                          key={i}
                          className="text-xs text-white/40 truncate"
                          style={{
                            animation: `slideIn 0.3s ease-out ${i * 0.05}s both`,
                            opacity: 0,
                          }}
                        >
                          <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle" style={{ background: c.hex + '60' }} />
                          {r.title}
                        </div>
                      ))}
                      {state.results.length > 8 && (
                        <div className="text-xs text-white/20 pl-3.5">
                          +{state.results.length - 8} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {searchPhase === 'ranking' && (
              <div className="text-center py-6" title="Ranking results using Borda count scoring and removing duplicates">
                <div className="inline-flex flex-col items-center gap-3">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-transparent" style={{ borderColor: '#dc3545', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                    <div className="absolute inset-2 rounded-full border-2 border-b-transparent" style={{ borderColor: '#3b5fc7', borderBottomColor: 'transparent', animation: 'spin 1.2s linear infinite reverse' }} />
                  </div>
                  <span className="text-white/40 text-sm">Ranking &amp; deduplicating...</span>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: '#dc3545', animation: `pulse 1s ease-in-out ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Info Bar */}
        {searchPhase === 'done' && results.length > 0 && (
          <div className="flex items-center justify-between mb-4 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-white/70" title={`${results.length} results after removing duplicates`}>
                <Counter value={results.length} className="text-white font-bold" /> unique results
              </span>
              {duplicates.length > 0 && (
                <button
                  onClick={() => setShowDuplicates(!showDuplicates)}
                  className="text-xs hover:underline transition-colors"
                  style={{ color: '#dc3545' }}
                  title={showDuplicates ? 'Hide duplicate results' : `${totalResults} total results before dedup — click to show ${duplicates.length} duplicate${duplicates.length > 1 ? 's' : ''} inline`}
                >
                  {showDuplicates ? `hide duplicates` : `${totalResults} total — show ${duplicates.length} dupes`}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {Object.entries(engineStates).map(([engine, state]) => {
                if (state.status !== 'done' || state.results.length === 0) return null;
                const c = ENGINE_COLORS[engine];
                const label = ENGINE_META.find(m => m.engine === engine)?.label || engine;
                return (
                  <span key={engine} className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: c.hex + '15', color: c.hex }} title={`${state.results.length} raw results fetched from ${label}`}>
                    {label}: {state.results.length}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Results List */}
        {searchPhase === 'done' && results.length > 0 && (
          <div className="space-y-3">
            {results.slice(0, visibleCount).map((result, index) => {
              const c = ENGINE_COLORS[result.sourceEngine] || ENGINE_COLORS.bing;
              const dupes = getDupesForResult(result);
              let hostname = '';
              try { hostname = new URL(result.url).hostname; } catch { hostname = result.url; }

              return (
                <div key={`r-${index}`} style={{ animation: `fadeSlideUp 0.3s ease-out both` }}>
                  {/* Primary result */}
                  <div
                    className="result-card rounded-xl overflow-hidden transition-all"
                    style={{
                      background: '#ffffff08',
                      border: `1px solid #ffffff10`,
                      borderLeft: `3px solid ${c.hex}`,
                    }}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group"
                          >
                            <h3 className="text-white font-medium group-hover:underline line-clamp-2 mb-1">
                              {result.title}
                            </h3>
                          </a>
                          <div className="flex items-center gap-2 text-xs text-white/30">
                            <span className="truncate">{hostname}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: '#ffffff10', color: '#ffffff80' }} title={`Ranking score: ${result.finalScore} — higher is better (Borda count + page bonus + diversity bonus)`}>
                            {result.finalScore}
                          </span>
                          {result.appearances > 1 && (
                            <span className="text-xs font-mono px-2 py-1 rounded flex items-center gap-1" style={{ background: '#22c55e15', color: '#22c55e' }} title={`Found in ${result.appearances} engines — results appearing across multiple engines score higher`}>
                              <TrendingUp className="h-3 w-3" />
                              {result.appearances}x
                            </span>
                          )}
                          {dupes.length > 0 && showDuplicates && (
                            <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: '#ffffff08', color: '#ffffff40' }} title={`${dupes.length} duplicate${dupes.length > 1 ? 's' : ''} from other engines shown below`}>
                              +{dupes.length} dupe{dupes.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      {result.snippet && (
                        <p className="text-sm text-white/40 line-clamp-2 mt-2">{result.snippet}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2.5">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: c.hex + '20', color: c.hex }}
                          title={`Source: ${result.sourceEngine}`}
                        >
                          {result.sourceEngine}
                        </span>
                        <span className="text-xs text-white/20" title={`Originally found on page ${result.originalPage}, position ${result.originalPosition}`}>p{result.originalPage} #{result.originalPosition}</span>
                      </div>
                    </div>
                  </div>

                  {/* Inline duplicates */}
                  {showDuplicates && dupes.map((dup, di) => {
                    const dc = ENGINE_COLORS[dup.sourceEngine] || ENGINE_COLORS.bing;
                    let dupHost = '';
                    try { dupHost = new URL(dup.url).hostname; } catch { dupHost = dup.url; }

                    return (
                      <div
                        key={`d-${index}-${di}`}
                        className="ml-6 mt-1 rounded-lg overflow-hidden opacity-40"
                        style={{
                          background: '#ffffff04',
                          border: `1px solid #ffffff08`,
                          borderLeft: `2px solid ${dc.hex}40`,
                        }}
                      >
                        <div className="px-3 py-2 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <a href={dup.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:underline truncate block">
                              {dup.title}
                            </a>
                            <span className="text-xs text-white/20">{dupHost}</span>
                          </div>
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: dc.hex + '15', color: dc.hex }}
                            title={`Duplicate from ${dup.sourceEngine}, page ${dup.originalPage} position ${dup.originalPosition}`}
                          >
                            {dup.sourceEngine} p{dup.originalPage}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state after search */}
        {searchPhase === 'done' && results.length === 0 && (
          <div className="text-center py-16">
            <p className="text-white/30">No results found. Try different search terms or engines.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/5 mt-16 py-6 text-center">
        <span className="text-xs text-white/20">&copy; 2026 Zero Shot Laboratories, Inc.</span>
      </footer>

      {/* Global CSS for animations */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressSweep {
          0% { width: 5%; opacity: 0.6; }
          50% { width: 80%; opacity: 1; }
          100% { width: 5%; opacity: 0.6; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes blobFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }
        .result-card:hover {
          box-shadow: 0 0 20px rgba(255,255,255,0.03);
          border-color: rgba(255,255,255,0.12) !important;
        }
      `}</style>
    </div>
  );
}

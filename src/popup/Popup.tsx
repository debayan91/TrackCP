import { useEffect, useState } from 'react';
import { Badge, Button, Input, Label, Select } from './components/ui';
import { ProblemMetadata, GitHubSettings } from '../utils/metadata';
import { Github, Code, Check, AlertCircle, Loader2, Settings, ExternalLink, Timer, Camera, CheckCircle2 } from 'lucide-react';

// const RepoConfigDefault = { repo: 'dsa-archive' };

const Popup = () => {
  const [loading, setLoading] = useState(true);
  const [scrapedData, setScrapedData] = useState<ProblemMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('dsa-archive');
  
  // Form State
  const [mode, setMode] = useState<'practice' | 'contest'>('practice');
  const [ratingOverride, setRatingOverride] = useState<string>('');
  const [difficultyOverride, setDifficultyOverride] = useState<string>('');
  const [pushing, setPushing] = useState(false);
  const [screenshotEnabled, setScreenshotEnabled] = useState(true);
  
  // Timer State
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    // 1. Load Settings
    chrome.storage.local.get(['github_token', 'github_owner', 'github_repo'], (result) => {
      if (result.github_token) setToken(result.github_token);
      if (result.github_owner) setOwner(result.github_owner);
      if (result.github_repo) setRepo(result.github_repo);
      
      if (!result.github_token) {
        setShowSettings(true);
      }
    });

    // 2. Scrape & Init Timer
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) return;
      
      chrome.tabs.sendMessage(activeTab.id, { action: 'SCRAPE' }, (response) => {
        setLoading(false);
        if (chrome.runtime.lastError) {
          setError("Please navigate to a problem page.");
          return;
        }
        
        if (response && response.success) {
          const data = response.data as ProblemMetadata;
          setScrapedData(data);
          
          // Init form defaults
          if (data.contestName || data.url.includes('/contest/')) {
            setMode('contest');
          } else {
            setMode('practice');
          }
          
          if (data.difficulty) setDifficultyOverride(data.difficulty);
          if (data.rating) setRatingOverride(data.rating.toString());

          // TIMER LOGIC (Popup Side)
          // Key: timer_{url}
          // We use URL from scraped data or tab url
          // data.url is from scraper
          const timerKey = `timer_${data.url}`;
          chrome.storage.local.get(timerKey, (res) => {
              if (res[timerKey]) {
                  // Timer exists, calc elapsed
                  const start = res[timerKey];
                  const mins = Math.round((Date.now() - start) / 60000);
                  setElapsedMinutes(mins);
              } else {
                  // Start timer now
                  const now = Date.now();
                  chrome.storage.local.set({ [timerKey]: now });
                  setElapsedMinutes(0); // Just started
              }
          });

        } else {
          setError(response?.error || "Failed to scrape page.");
        }
      });
    });
  }, []);

  const saveSettings = () => {
    chrome.storage.local.set({
      github_token: token,
      github_owner: owner,
      github_repo: repo
    }, () => {
      setShowSettings(false);
      setSuccessMsg("Settings saved!");
      setTimeout(() => setSuccessMsg(null), 2000);
    });
  };

  const handlePush = async () => {
    if (!scrapedData || !token || !owner || !repo) {
      setError("Missing settings or data.");
      return;
    }
    
    setPushing(true);
    setError(null);
    setSuccessMsg(null);
    
    // Construct final metadata
    const finalData: ProblemMetadata = {
      ...scrapedData,
      type: mode,
      rating: scrapedData.site !== 'leetcode' ? (parseInt(ratingOverride) || null) : undefined,
      difficulty: scrapedData.site === 'leetcode' ? (difficultyOverride as any) : undefined,
      solveTimeMinutes: elapsedMinutes // Use popup timer
    };

    const settings: GitHubSettings = { token, owner, repo };

    // Get current window ID for screenshot
    const windows = await chrome.windows.getCurrent();

    // Send to background
    chrome.runtime.sendMessage({
      action: 'PUSH_TO_GITHUB',
      payload: { 
          metadata: finalData, 
          settings, 
          includeScreenshot: screenshotEnabled,
          windowId: windows.id 
      }
    }, (response) => {
      setPushing(false);
      if (response && response.success) {
        setSuccessMsg("Pushed to GitHub & Progress Updated!");
        // Clear Timer
        const timerKey = `timer_${scrapedData.url}`;
        chrome.storage.local.remove(timerKey);
      } else {
        setError(response?.error || "Push failed.");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] w-[360px] bg-slate-950 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl"></div>
        <Loader2 className="animate-spin text-indigo-500 relative z-10 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]" size={36} />
        <p className="mt-4 text-indigo-300 text-sm font-medium tracking-wide animate-pulse">Initializing TrackCP...</p>
      </div>
    );
  }

  const renderHeader = () => (
    <div className="flex items-center justify-between p-4 border-b border-indigo-500/20 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-20">
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <Code className="text-white relative z-10" size={18} />
        </div>
        <h1 className="font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-purple-400">TrackCP</h1>
      </div>
      <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-full hover:bg-white/10 text-indigo-300 hover:text-indigo-100 transition-all active:scale-95">
        <Settings size={20} />
      </button>
    </div>
  );

  // Settings View
  if (showSettings) {
    return (
      <div className="flex flex-col h-[500px] w-[360px] bg-slate-950 text-slate-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-900/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-900/10 rounded-full blur-3xl pointer-events-none"></div>
        {renderHeader()}
        <div className="p-5 space-y-6 flex-1 overflow-y-auto relative z-10 glass-panel border-t-0 rounded-b-xl pb-6">
          <div className="space-y-2 group">
            <Label className="text-indigo-200 font-medium group-focus-within:text-indigo-400 transition-colors">GitHub PAT</Label>
            <Input 
              type="password" 
              placeholder="ghp_..." 
              value={token} 
              onChange={(e) => setToken(e.target.value)}
              className="bg-slate-950/50 border-slate-700/50 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 placeholder:text-slate-600 transition-all"
            />
            <p className="text-xs text-indigo-400/60 font-medium tracking-wide">Requires 'repo' scope</p>
          </div>
          <div className="space-y-2 group">
            <Label className="text-indigo-200 font-medium group-focus-within:text-indigo-400 transition-colors">GitHub Username</Label>
            <Input 
                value={owner} 
                onChange={(e) => setOwner(e.target.value)} 
                className="bg-slate-950/50 border-slate-700/50 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-slate-100"
            />
          </div>
          <div className="space-y-2 group">
            <Label className="text-indigo-200 font-medium group-focus-within:text-indigo-400 transition-colors">Repository</Label>
            <Input 
                value={repo} 
                onChange={(e) => setRepo(e.target.value)} 
                className="bg-slate-950/50 border-slate-700/50 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-slate-100"
            />
          </div>
          <div className="pt-6">
            <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5 transition-all duration-200 border-none h-10" 
                onClick={saveSettings}
            >
                Save Configuration
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error && !scrapedData) {
    return (
      <div className="flex flex-col h-[500px] w-[360px] bg-slate-950 text-slate-200 relative overflow-hidden">
        {renderHeader()}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-red-900/10 rounded-full blur-3xl"></div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 relative z-10 glass-panel m-4 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <AlertCircle className="text-red-400 drop-shadow-md" size={32} />
          </div>
          <p className="text-slate-300 font-medium leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // Main Form
  return (
    <div className="flex flex-col h-[500px] w-[360px] bg-slate-950 text-slate-200 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-purple-600/20 rounded-full blur-[80px] pointer-events-none"></div>
      
      {renderHeader()}
      
      {scrapedData && (
        <div className="p-4 space-y-5 flex-1 overflow-y-auto relative z-10 custom-scrollbar pb-6">
          {/* Header Info Card */}
          <div className="glass-panel p-4 rounded-2xl space-y-3 shadow-lg border-indigo-500/10 hover:border-indigo-500/20 transition-colors">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Badge className={
                        scrapedData.site === 'leetcode' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]' :
                        scrapedData.site === 'codeforces' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]' :
                        'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                    }>
                        <span className="font-semibold tracking-wide drop-shadow-sm">{scrapedData.site.toUpperCase()}</span>
                    </Badge>
                    {scrapedData.isAccepted && (
                        <span className="flex items-center gap-1 text-[10px] font-bold tracking-wide text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                            <CheckCircle2 size={12} className="drop-shadow-md" /> SOLVED
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 text-indigo-300 text-xs font-mono bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20">
                    <Timer size={12} className="text-indigo-400" /> {elapsedMinutes}m
                </div>
            </div>
            <div>
               <h2 className="font-bold text-lg leading-tight truncate text-white" title={scrapedData.problemName}>
                   {scrapedData.problemName}
               </h2>
               <a href={scrapedData.url} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-400/80 hover:text-indigo-300 flex items-center gap-1 mt-1 w-fit transition-colors group">
                    <span className="group-hover:underline underline-offset-2">View Original Problem</span>
                    <ExternalLink size={10} className="group-hover:-translate-y-[1px] group-hover:translate-x-[1px] transition-transform" />
               </a>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-1 bg-slate-900/60 p-1.5 rounded-xl border border-slate-700/50 backdrop-blur-sm shadow-inner relative">
            <div 
              className="absolute bg-indigo-600 rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.4)] inset-y-1 transition-all duration-300 ease-out"
              style={{ 
                  left: mode === 'practice' ? '4px' : 'calc(50% + 2px)', 
                  width: 'calc(50% - 6px)' 
              }}
            />
            {['practice', 'contest'].map((m) => (
                <button
                key={m}
                onClick={() => setMode(m as any)}
                className={`text-xs font-semibold py-1.5 rounded-lg transition-colors capitalize relative z-10 ${
                    mode === m ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                >
                {m}
                </button>
            ))}
          </div>

          {/* Dynamic Fields */}
          <div className="space-y-4 glass-panel rounded-2xl p-4">
            {scrapedData.site === 'leetcode' && mode === 'practice' && (
               <div className="space-y-1.5 group">
                 <Label className="text-indigo-200/80 text-[11px] uppercase tracking-wider font-semibold group-focus-within:text-indigo-400 transition-colors">Difficulty</Label>
                 <Select 
                    value={difficultyOverride} 
                    onChange={(e) => setDifficultyOverride(e.target.value)}
                    className="bg-slate-950/50 border-slate-700/50 focus:border-indigo-500/50 text-slate-200 transition-all font-medium py-2 shadow-inner"
                 >
                   <option value="Easy">Easy</option>
                   <option value="Medium">Medium</option>
                   <option value="Hard">Hard</option>
                 </Select>
               </div>
            )}

            {scrapedData.site !== 'leetcode' && mode === 'practice' && (
               <div className="space-y-1.5 group">
                 <Label className="text-indigo-200/80 text-[11px] uppercase tracking-wider font-semibold group-focus-within:text-indigo-400 transition-colors">Rating</Label>
                 <Input 
                    placeholder="e.g. 1500" 
                    value={ratingOverride}
                    onChange={(e) => setRatingOverride(e.target.value)}
                    className="bg-slate-950/50 border-slate-700/50 focus:border-indigo-500/50 text-slate-200 font-mono transition-all shadow-inner py-2"
                 />
               </div>
            )}
            
            <div className="space-y-1.5">
              <Label className="text-indigo-200/80 text-[11px] uppercase tracking-wider font-semibold">Source Code Snippet</Label>
              <div className="bg-[#0f111a] p-3 rounded-xl border border-indigo-500/20 text-[10px] font-mono text-zinc-400 h-28 overflow-hidden relative shadow-inner group">
                 {/* Fake Window Controls */}
                 <div className="flex gap-1.5 mb-2 opacity-60">
                     <div className="w-2 h-2 rounded-full bg-red-500/80"></div>
                     <div className="w-2 h-2 rounded-full bg-yellow-500/80"></div>
                     <div className="w-2 h-2 rounded-full bg-green-500/80"></div>
                 </div>
                 <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f111a] pointer-events-none opacity-90" />
                 <pre className="opacity-80">
                     <code className="text-indigo-300">class</code> <code className="text-purple-300">Solution</code> {'{\n'}
                     {'  '}...{'\n'}
                     {scrapedData.code ? scrapedData.code.split('\n').slice(0, 5).join('\n') : "// No code detected."}
                 </pre>
                 {scrapedData.code && (
                     <div className="absolute bottom-2 right-2 text-[9px] font-semibold tracking-wide bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 px-2 py-1 rounded-md shadow-sm backdrop-blur-md">
                         {scrapedData.code.length} chars
                     </div>
                 )}
              </div>
            </div>

            {/* Screenshot Toggle */}
            <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-indigo-300/80">
                    <Camera size={14} className="opacity-80" />
                    <span className="text-xs font-medium">Capture Screenshot</span>
                </div>
                <button 
                  onClick={() => setScreenshotEnabled(!screenshotEnabled)}
                  className={`w-10 h-5 rounded-full transition-all relative shadow-inner ${screenshotEnabled ? 'bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.4)]' : 'bg-slate-800'}`}
                >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${screenshotEnabled ? 'left-5 translate-x-0' : 'left-0.5'}`} />
                </button>
            </div>
          </div>

          {/* Action */}
          <div className="space-y-3 pt-2">
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex gap-2 items-start shadow-sm backdrop-blur-sm">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 opacity-80" />
                    <span className="font-medium">{error}</span>
                </div>
            )}
            {successMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex gap-2 items-center shadow-sm backdrop-blur-sm">
                    <Check size={16} className="opacity-80" />
                    <span className="font-medium">{successMsg}</span>
                </div>
            )}
            
            <Button 
              className={`w-full h-12 gap-2 text-[13px] font-bold tracking-wide uppercase transition-all duration-300 border-none ${
                  pushing || !scrapedData.code || !token 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] hover:-translate-y-0.5'
              }`} 
              onClick={handlePush} 
              disabled={pushing || !scrapedData.code || !token}
            >
              {pushing ? <Loader2 className="animate-spin text-white/70" size={18} /> : <Github size={18} className="drop-shadow-md" />}
              {pushing ? 'Committing...' : 'Push to GitHub'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Popup;

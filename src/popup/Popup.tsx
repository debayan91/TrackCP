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
      <div className="flex items-center justify-center h-full bg-slate-950">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  // Header
  const renderHeader = () => (
    <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <Code className="text-blue-500" size={20} />
        <h1 className="font-bold text-lg tracking-tight text-white">TrackCP</h1>
      </div>
      <button onClick={() => setShowSettings(!showSettings)} className="text-slate-400 hover:text-white transition-colors">
        <Settings size={18} />
      </button>
    </div>
  );

  // Settings View
  if (showSettings) {
    return (
      <div className="flex flex-col h-full bg-slate-950 text-slate-200">
        {renderHeader()}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <Label>GitHub PAT</Label>
            <Input 
              type="password" 
              placeholder="ghp_..." 
              value={token} 
              onChange={(e) => setToken(e.target.value)} 
            />
            <p className="text-xs text-slate-500">Requires 'repo' scope</p>
          </div>
          <div className="space-y-2">
            <Label>GitHub Username</Label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Repository</Label>
            <Input value={repo} onChange={(e) => setRepo(e.target.value)} />
          </div>
          <div className="pt-4">
            <Button className="w-full" onClick={saveSettings}>Save Settings</Button>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error && !scrapedData) {
    return (
      <div className="flex flex-col h-full bg-slate-950 text-slate-200">
        {renderHeader()}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <AlertCircle className="text-red-500" size={48} />
          <p className="text-slate-300">{error}</p>
        </div>
      </div>
    );
  }

  // Main Form
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      {renderHeader()}
      
      {scrapedData && (
        <div className="p-4 space-y-5 flex-1 overflow-y-auto">
          {/* Header Info */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Badge className={
                        scrapedData.site === 'leetcode' ? 'bg-yellow-900/40 text-yellow-400 border-yellow-700/50' :
                        scrapedData.site === 'codeforces' ? 'bg-blue-900/40 text-blue-400 border-blue-700/50' :
                        'bg-amber-900/40 text-amber-500 border-amber-700/50'
                    }>
                        {scrapedData.site.toUpperCase()}
                    </Badge>
                    {scrapedData.isAccepted && (
                        <span className="flex items-center gap-1 text-[10px] text-green-400 border border-green-800/50 bg-green-900/20 px-1.5 py-0.5 rounded-full">
                            <CheckCircle2 size={10} /> Solved
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1 text-slate-400 text-xs font-mono">
                    <Timer size={12} /> {elapsedMinutes}m
                </div>
            </div>
            <h2 className="font-semibold text-lg leading-tight truncate" title={scrapedData.problemName}>
                {scrapedData.problemName}
            </h2>
            <a href={scrapedData.url} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-blue-400 flex items-center gap-1 w-fit">
                 View Problem <ExternalLink size={10} />
            </a>
          </div>

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {['practice', 'contest'].map((m) => (
                <button
                key={m}
                onClick={() => setMode(m as any)}
                className={`text-xs font-medium py-1.5 rounded-md transition-all capitalize ${
                    mode === m ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                >
                {m}
                </button>
            ))}
          </div>

          {/* Dynamic Fields */}
          <div className="space-y-4 border border-slate-800 rounded-xl p-3 bg-slate-900/50">
            {scrapedData.site === 'leetcode' && mode === 'practice' && (
               <div className="space-y-1.5">
                 <Label>Difficulty</Label>
                 <Select value={difficultyOverride} onChange={(e) => setDifficultyOverride(e.target.value)}>
                   <option value="Easy">Easy</option>
                   <option value="Medium">Medium</option>
                   <option value="Hard">Hard</option>
                 </Select>
               </div>
            )}

            {scrapedData.site !== 'leetcode' && mode === 'practice' && (
              <div className="space-y-1.5">
                <Label>Rating</Label>
                <div className="flex gap-2">
                   <Input 
                      placeholder="e.g. 1500" 
                      value={ratingOverride}
                      onChange={(e) => setRatingOverride(e.target.value)}
                      className="font-mono"
                   />
                </div>
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label>Source Code</Label>
              <div className="bg-slate-950 p-2 rounded-md border border-slate-800 text-[10px] font-mono text-slate-400 h-20 overflow-hidden relative">
                 <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/90 pointer-events-none" />
                 <pre>{scrapedData.code || "No code detected."}</pre>
                 {scrapedData.code && <div className="absolute bottom-1 right-1 text-[9px] bg-slate-800 px-1.5 rounded text-slate-300">{scrapedData.code.length} chars</div>}
              </div>
            </div>

            {/* Screenshot Toggle */}
            <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-slate-300">
                    <Camera size={14} />
                    <span className="text-xs">Include 'Accepted' Screenshot</span>
                </div>
                <button 
                  onClick={() => setScreenshotEnabled(!screenshotEnabled)}
                  className={`w-8 h-4 rounded-full transition-colors relative ${screenshotEnabled ? 'bg-green-600' : 'bg-slate-700'}`}
                >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${screenshotEnabled ? 'left-4.5 translate-x-0' : 'left-0.5'}`} style={{ left: screenshotEnabled ? 'calc(100% - 14px)' : '2px'}} />
                </button>
            </div>
          </div>

          {/* Action */}
          <div className="space-y-3 pt-1">
            {error && (
                <div className="p-2 bg-red-900/20 border border-red-900/50 rounded text-red-200 text-xs flex gap-2 items-start">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {successMsg && (
                <div className="p-2 bg-green-900/20 border border-green-900/50 rounded text-green-200 text-xs flex gap-2 items-center">
                    <Check size={14} />
                    <span>{successMsg}</span>
                </div>
            )}
            
            <Button 
              className="w-full h-10 gap-2 font-semibold shadow-lg shadow-blue-900/20" 
              onClick={handlePush} 
              disabled={pushing || !scrapedData.code || !token}
            >
              {pushing ? <Loader2 className="animate-spin" size={16} /> : <Github size={16} />}
              {pushing ? 'Pushing to GitHub...' : 'Push Solution'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Popup;

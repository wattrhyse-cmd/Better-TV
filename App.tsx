
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { User, Lock, Server, PlayCircle, Search, AlertCircle, Sparkles, Send, Tv, Play, Info, ArrowLeft, Star, Clock, Wifi, Check, Palette, Trophy, Calendar, Captions, Download, Smartphone, Heart, RefreshCw, CloudDownload, Globe, ShieldCheck, Activity, List, Link as LinkIcon, Edit3, Loader2 } from 'lucide-react';

import VideoPlayer from './components/VideoPlayer';
import Sidebar from './components/Sidebar';
import { LoginCredentials, StreamItem, StreamCategory, AppView, StreamType, AppTheme, EPGProgram, XtreamLiveStream, XtreamVodStream, XtreamSeriesStream } from './types';
import { MOCK_CATEGORIES, MOCK_STREAMS, APP_THEMES } from './constants';
import { getAIRecommendations } from './services/geminiService';
import { authenticateUser, fetchXtreamData, mapLiveStreamToItem, mapVodStreamToItem, mapSeriesStreamToItem } from './services/iptvService';

// --- EPG Helper Functions ---
const generateMockEPG = (stream: StreamItem, now: Date): { current: EPGProgram, next: EPGProgram } => {
  // Round down to nearest hour for consistent blocks
  const currentHourStart = new Date(now);
  currentHourStart.setMinutes(0, 0, 0);
  
  // Generic schedule templates based on stream name/category keywords
  let programTitles = ["Daily News", "Weather Report", "Morning Show", "Afternoon Special", "Prime Time Movie"];
  
  if (stream.category_id === '8' || stream.name.toLowerCase().includes('sport')) {
     programTitles = ["Live: Premier League Match", "Match Analysis", "Sports Center", "Classic Goals", "F1 Highlights", "Live: Tennis Open", "Boxing: Fight Night"];
  } else if (stream.category_id === '6' || stream.stream_type === 'movie') {
     programTitles = ["Cinema: Action Hero", "Director's Cut: Sci-Fi", "Comedy Hour", "Blockbuster Movie", "Late Night Thriller"];
  } else if (stream.name.toLowerCase().includes('kids') || stream.category_id === '5') {
     programTitles = ["Cartoon Fun", "Super Heroes", "Learning Time", "Animated Adventures", "Bedtime Stories"];
  }

  // Create deterministic pseudo-random programs based on stream ID + hour
  const getProgramForTime = (startTime: Date): EPGProgram => {
      const seed = stream.stream_id + startTime.getHours();
      const titleIndex = seed % programTitles.length;
      
      const endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + 1);

      return {
          title: programTitles[titleIndex],
          start: startTime,
          end: endTime,
          description: `Enjoy the best of ${programTitles[titleIndex]}. Full coverage and exclusive content strictly on ${stream.name}.`
      };
  };

  const currentProgram = getProgramForTime(currentHourStart);
  
  // Handling the case where we might be in the middle of a program
  // For this mock, programs are 1 hour long fixed blocks for simplicity
  const nextStart = new Date(currentHourStart);
  nextStart.setHours(currentHourStart.getHours() + 1);
  const nextProgram = getProgramForTime(nextStart);

  return { current: currentProgram, next: nextProgram };
};

const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const App: React.FC = () => {
  // --- State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('DASHBOARD');
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(APP_THEMES[0]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [preferredQuality, setPreferredQuality] = useState('Auto');
  const [epgRefreshInterval, setEpgRefreshInterval] = useState(1); // Default 1 minute
  
  // Favorites State (Persisted in LocalStorage)
  const [favorites, setFavorites] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('genie_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Updates State
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'completed'>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);

  // Login Form State
  const [loginMethod, setLoginMethod] = useState<'XTREAM' | 'M3U'>('XTREAM');
  const [credentials, setCredentials] = useState<LoginCredentials>({ name: '', url: '', username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Data State
  const [categories, setCategories] = useState<StreamCategory[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  
  // Player/Browsing State
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStream, setSelectedStream] = useState<StreamItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI State
  const [heroImage, setHeroImage] = useState<string>('');

  // AI Chat State
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // --- Effects ---

  // Persist Favorites
  useEffect(() => {
    localStorage.setItem('genie_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Reset update status when leaving update view
  useEffect(() => {
      if (currentView !== 'UPDATES') {
          setUpdateStatus('idle');
          setUpdateProgress(0);
      }
  }, [currentView]);

  // PWA Install Prompt Listener
  useEffect(() => {
      const handleBeforeInstallPrompt = (e: any) => {
          // Prevent the mini-infobar from appearing on mobile
          e.preventDefault();
          // Stash the event so it can be triggered later.
          setInstallPrompt(e);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      return () => {
          window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
  }, []);

  const handleInstallClick = () => {
      if (!installPrompt) return;
      // Show the install prompt
      installPrompt.prompt();
      // Wait for the user to respond to the prompt
      installPrompt.userChoice.then((choiceResult: any) => {
          if (choiceResult.outcome === 'accepted') {
              console.log('User accepted the install prompt');
          } else {
              console.log('User dismissed the install prompt');
          }
          setInstallPrompt(null);
      });
  };

  // Clock for EPG
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), epgRefreshInterval * 60 * 1000); 
    return () => clearInterval(timer);
  }, [epgRefreshInterval]);

  useEffect(() => {
     // Set a random hero image from movies
     const movies = streams.filter(s => s.stream_type === StreamType.MOVIE);
     if (movies.length > 0) {
         setHeroImage(movies[Math.floor(Math.random() * movies.length)].stream_icon || '');
     }
  }, [streams]);

  // Login Process
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    setLoadingMessage('Authenticating...');

    if (loginMethod === 'XTREAM') {
        if (!credentials.username || !credentials.password || !credentials.url) {
            setLoginError('Please fill in all required fields');
            setIsLoggingIn(false);
            return;
        }

        // --- URL Sanitization ---
        let serverUrl = credentials.url.trim();
        // Automatically add http:// if protocol is missing
        if (!/^https?:\/\//i.test(serverUrl)) {
            serverUrl = `http://${serverUrl}`;
        }
        // Remove trailing slash for consistency
        serverUrl = serverUrl.replace(/\/$/, '');

        // Use these normalized credentials for all API calls
        const finalCredentials = { ...credentials, url: serverUrl };
        
        // Update state to reflect the fixed URL
        setCredentials(finalCredentials);

        try {
            // 1. Authenticate
            const authResponse = await authenticateUser(finalCredentials);
            if (!authResponse) {
                // This shouldn't happen with the new service throwing errors, but as a fallback
                throw new Error('Invalid response from server');
            }

            // 2. Fetch Data
            setLoadingMessage('Fetching Live Categories...');
            const liveCats = await fetchXtreamData(finalCredentials, 'get_live_categories');
            
            setLoadingMessage('Fetching Live Channels...');
            const liveStreams = await fetchXtreamData(finalCredentials, 'get_live_streams');

            setLoadingMessage('Fetching VOD Categories...');
            const vodCats = await fetchXtreamData(finalCredentials, 'get_vod_categories');

            setLoadingMessage('Fetching Movies...');
            const vodStreams = await fetchXtreamData(finalCredentials, 'get_vod_streams');
            
            setLoadingMessage('Fetching Series...');
            const seriesCats = await fetchXtreamData(finalCredentials, 'get_series_categories');
            const seriesStreams = await fetchXtreamData(finalCredentials, 'get_series');

            // 3. Process Data
            setLoadingMessage('Processing content...');
            
            // Map Categories
            const allCats: StreamCategory[] = [
                ...liveCats,
                ...vodCats,
                ...seriesCats
            ];

            // Map Streams
            const mappedLive = liveStreams.map((s: XtreamLiveStream) => mapLiveStreamToItem(s, finalCredentials));
            const mappedVod = vodStreams.map((s: XtreamVodStream) => mapVodStreamToItem(s, finalCredentials));
            const mappedSeries = seriesStreams.map((s: XtreamSeriesStream) => mapSeriesStreamToItem(s));

            const allStreams = [...mappedLive, ...mappedVod, ...mappedSeries];

            setCategories(allCats);
            setStreams(allStreams);
            setIsAuthenticated(true);
            setCurrentView('DASHBOARD');
            
        } catch (err: any) {
            console.error("Login Error:", err);
            let message = 'Connection failed. Please check your credentials.';

            // Improve error messaging for common CORS/Mixed Content issues
            const errorMessage = err.message || '';
            const isNetworkError = errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch');
            
            if (isNetworkError) {
                const isHttps = window.location.protocol === 'https:';
                const isHttpTarget = finalCredentials.url.toLowerCase().startsWith('http:');
                
                if (isHttps && isHttpTarget) {
                    message = 'Mixed Content Error: You are trying to connect to an unsecured HTTP server from a secure HTTPS app. Browser security blocks this.';
                } else {
                    message = 'Network Error: The server blocked the connection (CORS). Your provider may not allow browser-based streaming.';
                }
            } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
                message = 'Access Denied: Invalid username or password.';
            } else if (errorMessage.includes('404')) {
                message = 'Server Not Found: Check the URL/DNS.';
            }

            setLoginError(message);
        } finally {
            setIsLoggingIn(false);
            setLoadingMessage('');
        }
    } else {
        // M3U Login Mock
        setTimeout(() => {
             setLoginError('M3U playlist support coming soon');
             setIsLoggingIn(false);
        }, 1000);
    }
  };

  const loadDemo = () => {
    setIsLoggingIn(true);
    setLoadingMessage('Loading Demo Environment...');
    setTimeout(() => {
        setCredentials({
            name: 'Demo Playlist',
            url: 'http://demo-iptv.com:3330',
            username: 'demo_user',
            password: 'demo_password'
        });
        setCategories(MOCK_CATEGORIES);
        setStreams(MOCK_STREAMS);
        setIsAuthenticated(true);
        setCurrentView('DASHBOARD');
        setIsLoggingIn(false);
        setLoadingMessage('');
    }, 1500);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCredentials({ name: '', url: '', username: '', password: '' });
    setSelectedStream(null);
    setCurrentView('LOGIN');
    setStreams([]);
    setCategories([]);
  };

  const handleStreamProgress = useCallback((progress: number) => {
    if (selectedStream) {
        setStreams(prevStreams => 
            prevStreams.map(s => 
                s.stream_id === selectedStream.stream_id 
                ? { ...s, progress } 
                : s
            )
        );
    }
  }, [selectedStream]);

  const toggleFavorite = (streamId: number) => {
    setFavorites(prev => {
      if (prev.includes(streamId)) {
        return prev.filter(id => id !== streamId);
      } else {
        return [...prev, streamId];
      }
    });
  };

  // Update Logic
  const checkForUpdates = () => {
      setUpdateStatus('checking');
      // Simulate network request
      setTimeout(() => {
          setUpdateStatus('available');
      }, 2500);
  };

  const startUpdate = () => {
      setUpdateStatus('downloading');
      setUpdateProgress(0);
      
      const interval = setInterval(() => {
          setUpdateProgress(prev => {
              const next = prev + Math.random() * 15;
              if (next >= 100) {
                  clearInterval(interval);
                  setUpdateStatus('completed');
                  setTimeout(() => {
                      window.location.reload();
                  }, 1500);
                  return 100;
              }
              return next;
          });
      }, 500);
  };

  // --- Filtering Logic ---
  
  const filteredStreams = useMemo(() => {
    let typeFilter = '';
    if (currentView === 'LIVE') typeFilter = StreamType.LIVE;
    if (currentView === 'MOVIES') typeFilter = StreamType.MOVIE;
    if (currentView === 'SERIES') typeFilter = StreamType.SERIES;
    
    // For FAVORITES view, we only show what's in the favorites list
    // If user is searching within favorites, we apply that too
    if (currentView === 'FAVORITES') {
        return streams.filter(stream => {
            const isFav = favorites.includes(stream.stream_id);
            const matchesSearch = stream.name.toLowerCase().includes(searchTerm.toLowerCase());
            return isFav && matchesSearch;
        });
    }

    return streams.filter(stream => {
      const matchesType = typeFilter ? stream.stream_type === typeFilter : true;
      const matchesCategory = selectedCategory ? stream.category_id === selectedCategory : true;
      const matchesSearch = stream.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesCategory && matchesSearch;
    });
  }, [streams, currentView, selectedCategory, searchTerm, favorites]);

  // Next Channel / Stream Logic
  const handleNextStream = useCallback(() => {
      if (!selectedStream) return;
      const currentIndex = filteredStreams.findIndex(s => s.stream_id === selectedStream.stream_id);
      if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % filteredStreams.length;
          setSelectedStream(filteredStreams[nextIndex]);
      }
  }, [selectedStream, filteredStreams]);

  const activeCategories = useMemo(() => {
     if (currentView === 'FAVORITES') return [];

     return categories.filter(cat => {
         let typeFilter = '';
         if (currentView === 'LIVE') typeFilter = StreamType.LIVE;
         if (currentView === 'MOVIES') typeFilter = StreamType.MOVIE;
         if (currentView === 'SERIES') typeFilter = StreamType.SERIES;
         return streams.some(s => s.category_id === cat.category_id && s.stream_type === typeFilter);
     });
  }, [categories, streams, currentView]);

  const continueWatchingItems = useMemo(() => {
    return streams.filter(s => s.progress && s.progress > 0 && s.progress < 98);
  }, [streams]);

  // EPG Data for Selected Stream
  const selectedStreamEPG = useMemo(() => {
      if (!selectedStream || selectedStream.stream_type !== StreamType.LIVE) return null;
      return generateMockEPG(selectedStream, currentTime);
  }, [selectedStream, currentTime]);


  // --- Helpers ---
  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return 'Good Morning';
      if (hour < 18) return 'Good Afternoon';
      return 'Good Evening';
  };

  const handleAskAI = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    const response = await getAIRecommendations(aiQuery, streams);
    setAiResponse(response);
    setAiLoading(false);
  };

  // --- Render Sections ---

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen ${currentTheme.colors.background} flex items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-500`}>
        {/* Modern Background */}
        <div className="absolute inset-0 overflow-hidden">
            <div className={`absolute -top-[30%] -left-[10%] w-[800px] h-[800px] ${currentTheme.colors.bgAccent} opacity-20 rounded-full blur-[120px] animate-pulse`}></div>
            <div className="absolute bottom-[0%] -right-[10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[100px]"></div>
        </div>

        <div className="w-full max-w-md bg-white/5 backdrop-blur-2xl p-8 md:p-10 rounded-3xl border border-white/10 shadow-2xl z-10 relative">
            <div className="text-center mb-8">
                <div className={`w-16 h-16 bg-gradient-to-tr ${currentTheme.colors.gradient} rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-xl`}>
                    <Tv className="text-white w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">StreamGenie</h1>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Premium Player</p>
            </div>

            {/* Login Method Tabs */}
            <div className="flex p-1 bg-black/30 rounded-xl mb-6 border border-white/5">
                <button 
                    onClick={() => setLoginMethod('XTREAM')}
                    className={`flex-1 flex items-center justify-center py-2.5 rounded-lg text-xs font-bold transition-all ${loginMethod === 'XTREAM' ? `${currentTheme.colors.bgAccent} text-white shadow-lg` : 'text-slate-400 hover:text-white'}`}
                >
                    <List className="w-3.5 h-3.5 mr-2" /> Xtream Codes
                </button>
                <button 
                    onClick={() => setLoginMethod('M3U')}
                    className={`flex-1 flex items-center justify-center py-2.5 rounded-lg text-xs font-bold transition-all ${loginMethod === 'M3U' ? `${currentTheme.colors.bgAccent} text-white shadow-lg` : 'text-slate-400 hover:text-white'}`}
                >
                    <LinkIcon className="w-3.5 h-3.5 mr-2" /> M3U Playlist
                </button>
            </div>

            {loginMethod === 'XTREAM' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Any Name</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Edit3 className={`h-4 w-4 text-slate-500 group-focus-within:${currentTheme.colors.textAccent} transition-colors`} />
                            </div>
                            <input 
                                type="text" 
                                className={`block w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:${currentTheme.colors.borderAccent} focus:ring-1 focus:ring-opacity-50 text-white transition-all`} 
                                placeholder="Playlist Name (Optional)"
                                value={credentials.name || ''}
                                onChange={(e) => setCredentials({...credentials, name: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Username</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <User className={`h-4 w-4 text-slate-500 group-focus-within:${currentTheme.colors.textAccent} transition-colors`} />
                            </div>
                            <input 
                                type="text" 
                                className={`block w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:${currentTheme.colors.borderAccent} focus:ring-1 focus:ring-opacity-50 text-white transition-all`} 
                                placeholder="Username"
                                value={credentials.username}
                                onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock className={`h-4 w-4 text-slate-500 group-focus-within:${currentTheme.colors.textAccent} transition-colors`} />
                            </div>
                            <input 
                                type="password" 
                                className={`block w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:${currentTheme.colors.borderAccent} focus:ring-1 focus:ring-opacity-50 text-white transition-all`} 
                                placeholder="••••••••"
                                value={credentials.password}
                                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">DNS / URL</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Server className={`h-4 w-4 text-slate-500 group-focus-within:${currentTheme.colors.textAccent} transition-colors`} />
                            </div>
                            <input 
                                type="text" 
                                className={`block w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:${currentTheme.colors.borderAccent} focus:ring-1 focus:ring-opacity-50 text-white transition-all`} 
                                placeholder="http://provider.com:3330"
                                value={credentials.url}
                                onChange={(e) => setCredentials({...credentials, url: e.target.value})}
                            />
                        </div>
                    </div>

                    {loginError && (
                        <div className="flex items-center text-red-400 text-xs bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                            {loginError}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={isLoggingIn}
                        className={`w-full bg-gradient-to-r ${currentTheme.colors.gradient} hover:opacity-90 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2 flex items-center justify-center`}
                    >
                        {isLoggingIn ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {loadingMessage || 'Authenticating...'}
                            </>
                        ) : 'Connect Provider'}
                    </button>
                </form>
            ) : (
                <div className="py-12 text-center space-y-4">
                     <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-2">
                         <LinkIcon className="w-8 h-8 text-slate-600" />
                     </div>
                     <h3 className="text-white font-bold">M3U Playlist</h3>
                     <p className="text-slate-400 text-sm px-6">Direct M3U/M3U8 playlist URL loading is coming soon in the next update.</p>
                     <button 
                        onClick={() => setLoginMethod('XTREAM')}
                        className="text-cyan-400 text-sm hover:underline"
                     >
                        Use Xtream Codes instead
                     </button>
                </div>
            )}

            <div className="mt-6 text-center border-t border-white/5 pt-6">
                <button 
                    onClick={loadDemo}
                    disabled={isLoggingIn}
                    className={`text-xs text-slate-500 hover:${currentTheme.colors.textAccent} transition-colors`}
                >
                    Load Demo Playlist
                </button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen ${currentTheme.colors.background} text-white overflow-hidden font-sans transition-colors duration-500`}>
      <Sidebar 
          currentView={currentView} 
          onChangeView={(v) => { setCurrentView(v); setSelectedCategory(null); }} 
          onLogout={handleLogout} 
          theme={currentTheme}
          showInstall={!!installPrompt}
          onInstall={handleInstallClick}
      />
      
      {/* 
          Main Content Wrapper 
          We add pb-16 on mobile (md:pb-0) so the fixed bottom nav doesn't hide content 
      */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative pb-16 md:pb-0">
        
        {/* Premium Header */}
        <header className={`h-20 flex items-center justify-between px-4 md:px-8 bg-gradient-to-b from-black/20 to-transparent backdrop-blur-md z-20 border-b border-white/5 flex-shrink-0`}>
            <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    {currentView === 'DASHBOARD' && (
                        <>
                           <span className={`text-transparent bg-clip-text bg-gradient-to-r ${currentTheme.colors.gradient}`}>{getGreeting()}</span>
                           <span className="hidden sm:inline">, {credentials.username || 'User'}</span>
                        </>
                    )}
                    {currentView === 'LIVE' && <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Live TV</>}
                    {currentView === 'MOVIES' && 'Movies'}
                    {currentView === 'SERIES' && 'Series'}
                    {currentView === 'FAVORITES' && <span className="text-pink-500 flex items-center gap-2"><Heart className="fill-current" /> Favorites</span>}
                    {currentView === 'AI_SEARCH' && 'AI Curator'}
                    {currentView === 'UPDATES' && 'System Updates'}
                    {currentView === 'SETTINGS' && 'Settings'}
                </h2>
                <p className="text-xs text-slate-500 font-medium hidden sm:block">
                    {currentView === 'DASHBOARD' ? 'Welcome to your streaming hub' : 
                     currentView === 'FAVORITES' ? 'Your favorite channels and shows' :
                     currentView === 'SETTINGS' ? 'Customize your experience' :
                     currentView === 'UPDATES' ? 'Check for latest app versions' :
                     'Browse your content library'}
                </p>
            </div>
            
            <div className="flex items-center space-x-6">
                 {(currentView === 'LIVE' || currentView === 'MOVIES' || currentView === 'SERIES' || currentView === 'FAVORITES') && (
                    <div className="relative group">
                        <Search className={`absolute left-3 top-2.5 text-slate-500 w-4 h-4 group-focus-within:${currentTheme.colors.textAccent} transition-colors`} />
                        <input 
                            type="text" 
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`bg-slate-800/50 border border-slate-700/50 rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:${currentTheme.colors.borderAccent} focus:bg-slate-800 transition-all w-28 focus:w-48 sm:w-48 sm:focus:w-64`}
                        />
                    </div>
                )}
                
                <div className="flex items-center space-x-4 border-l border-white/10 pl-6">
                    <div className="text-right hidden lg:block">
                        <div className="text-xs font-bold text-white">Pro Plan</div>
                        <div className={`text-[10px] ${currentTheme.colors.textAccent} flex items-center justify-end gap-1`}>
                            <Wifi className="w-3 h-3" /> Connected
                        </div>
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center">
                        <User className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                    </div>
                </div>
            </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
            
            {/* --- DASHBOARD VIEW --- */}
            {currentView === 'DASHBOARD' && (
                <div className="h-full overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    {/* Hero Section */}
                    <div className="relative w-full h-56 md:h-80 rounded-3xl overflow-hidden mb-8 shadow-2xl shadow-black/50 group">
                        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105" style={{ backgroundImage: `url(${heroImage || 'https://images.unsplash.com/photo-1593784653256-42d3a3d528b6?auto=format&fit=crop&q=80&w=2000'})` }} />
                        <div className={`absolute inset-0 bg-gradient-to-t ${currentTheme.colors.gradient.replace('from-', 'from-black ').replace('to-', 'to-black/10 ')} opacity-90`} />
                        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent"></div>
                        
                        <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full md:w-2/3">
                            <span className={`inline-block px-3 py-1 ${currentTheme.colors.iconBg} ${currentTheme.colors.textAccent} rounded-full text-xs font-bold mb-3 border border-white/10 backdrop-blur-sm`}>TRENDING NOW</span>
                            <h1 className="text-2xl md:text-5xl font-bold text-white mb-3">Unlimited Entertainment</h1>
                            <p className="text-slate-300 mb-6 line-clamp-2 text-sm md:text-base">Discover the latest movies, binge-worthy series, and live sports events all in one place. Your premium streaming experience starts here.</p>
                            <button onClick={() => setCurrentView('MOVIES')} className={`${currentTheme.colors.bgAccent} ${currentTheme.colors.bgAccentHover} text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg text-sm md:text-base`}>
                                <Play className="w-5 h-5 fill-current" /> Watch Now
                            </button>
                        </div>
                    </div>

                    {/* Continue Watching Section */}
                    {continueWatchingItems.length > 0 && (
                        <div className="mb-10 animate-fadeIn">
                             <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                                <Clock className={`w-5 h-5 ${currentTheme.colors.textAccent} mr-2`} /> Continue Watching
                             </h3>
                             <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar">
                                {continueWatchingItems.map(item => (
                                   <div 
                                      key={item.stream_id}
                                      onClick={() => {
                                          setSelectedStream(item);
                                          setCurrentView(item.stream_type === StreamType.MOVIE ? 'MOVIES' : 'SERIES');
                                      }}
                                      className="flex-shrink-0 w-64 group cursor-pointer"
                                   >
                                        <div className={`relative aspect-video rounded-xl overflow-hidden ${currentTheme.colors.cardBg} shadow-lg border border-white/5 group-hover:${currentTheme.colors.borderAccent} transition-all`}>
                                            <img src={item.stream_icon} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-50 group-hover:scale-100">
                                                    <Play className="w-4 h-4 fill-white text-white" />
                                                </div>
                                            </div>
                                            
                                            {/* Progress Bar */}
                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700">
                                                <div 
                                                    className={`h-full ${currentTheme.colors.bgAccent}`}
                                                    style={{ width: `${item.progress}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-2 px-1">
                                            <h4 className="text-sm font-medium text-slate-200 truncate">{item.name}</h4>
                                            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                                <span>{item.stream_type === StreamType.MOVIE ? 'Movie' : 'Series'}</span>
                                                <span>{item.progress}% left</span>
                                            </div>
                                        </div>
                                   </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {/* Quick Access Cards */}
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center"><Star className="w-4 h-4 text-yellow-500 mr-2 fill-current" /> Quick Access</h3>
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
                        <div onClick={() => { setCurrentView('LIVE'); setSelectedCategory(null); }} className={`cursor-pointer ${currentTheme.colors.cardBg} hover:bg-opacity-80 p-4 md:p-6 rounded-2xl border border-white/5 hover:${currentTheme.colors.borderAccent} transition-all hover:-translate-y-1 hover:shadow-xl group relative overflow-hidden`}>
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Tv className="w-16 h-16 md:w-24 md:h-24 text-rose-500" />
                            </div>
                            <div className="w-10 h-10 md:w-14 md:h-14 bg-rose-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-rose-500 transition-colors">
                                <Tv className="text-rose-500 group-hover:text-white w-5 h-5 md:w-7 md:h-7" />
                            </div>
                            <h3 className="text-base md:text-xl font-bold text-white mb-1">Live TV</h3>
                            <p className="text-slate-400 text-xs">All Channels</p>
                        </div>

                         <div onClick={() => { setCurrentView('LIVE'); setSelectedCategory('8'); }} className={`cursor-pointer ${currentTheme.colors.cardBg} hover:bg-opacity-80 p-4 md:p-6 rounded-2xl border border-white/5 hover:${currentTheme.colors.borderAccent} transition-all hover:-translate-y-1 hover:shadow-xl group relative overflow-hidden`}>
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Trophy className="w-16 h-16 md:w-24 md:h-24 text-blue-500" />
                            </div>
                            <div className="w-10 h-10 md:w-14 md:h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-500 transition-colors">
                                <Trophy className="text-blue-500 group-hover:text-white w-5 h-5 md:w-7 md:h-7" />
                            </div>
                            <h3 className="text-base md:text-xl font-bold text-white mb-1">UK Sports</h3>
                            <p className="text-slate-400 text-xs">Premier League</p>
                        </div>

                        <div onClick={() => { setCurrentView('MOVIES'); setSelectedCategory(null); }} className={`cursor-pointer ${currentTheme.colors.cardBg} hover:bg-opacity-80 p-4 md:p-6 rounded-2xl border border-white/5 hover:${currentTheme.colors.borderAccent} transition-all hover:-translate-y-1 hover:shadow-xl group relative overflow-hidden`}>
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <PlayCircle className="w-16 h-16 md:w-24 md:h-24 text-cyan-500" />
                            </div>
                            <div className="w-10 h-10 md:w-14 md:h-14 bg-cyan-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-cyan-500 transition-colors">
                                <PlayCircle className="text-cyan-500 group-hover:text-white w-5 h-5 md:w-7 md:h-7" />
                            </div>
                            <h3 className="text-base md:text-xl font-bold text-white mb-1">Movies</h3>
                            <p className="text-slate-400 text-xs">Blockbusters</p>
                        </div>

                        <div onClick={() => { setCurrentView('SERIES'); setSelectedCategory(null); }} className={`cursor-pointer ${currentTheme.colors.cardBg} hover:bg-opacity-80 p-4 md:p-6 rounded-2xl border border-white/5 hover:${currentTheme.colors.borderAccent} transition-all hover:-translate-y-1 hover:shadow-xl group relative overflow-hidden`}>
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Tv className="w-16 h-16 md:w-24 md:h-24 text-purple-500" />
                            </div>
                            <div className="w-10 h-10 md:w-14 md:h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-500 transition-colors">
                                <Tv className="text-purple-500 group-hover:text-white w-5 h-5 md:w-7 md:h-7" />
                            </div>
                            <h3 className="text-base md:text-xl font-bold text-white mb-1">Series</h3>
                            <p className="text-slate-400 text-xs">Shows</p>
                        </div>

                        <div onClick={() => setCurrentView('AI_SEARCH')} className={`cursor-pointer ${currentTheme.colors.cardBg} hover:bg-opacity-80 p-4 md:p-6 rounded-2xl border border-white/5 hover:${currentTheme.colors.borderAccent} transition-all hover:-translate-y-1 hover:shadow-xl group relative overflow-hidden col-span-2 md:col-span-1`}>
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Sparkles className="w-16 h-16 md:w-24 md:h-24 text-emerald-500" />
                            </div>
                            <div className="w-10 h-10 md:w-14 md:h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-500 transition-colors">
                                <Sparkles className="text-emerald-500 group-hover:text-white w-5 h-5 md:w-7 md:h-7" />
                            </div>
                            <h3 className="text-base md:text-xl font-bold text-white mb-1">AI Curator</h3>
                            <p className="text-slate-400 text-xs">Recommendations</p>
                        </div>
                    </div>
                </div>
            )}
            
            {/* --- SETTINGS / THEMES VIEW --- */}
            {currentView === 'SETTINGS' && (
                <div className="p-4 md:p-8 h-full overflow-y-auto">
                    <div className="max-w-5xl mx-auto">
                        
                        {/* Account Info Section */}
                        <div className="mb-10 border-b border-white/5 pb-10">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white mb-2 flex items-center">
                                    <ShieldCheck className={`w-6 h-6 mr-3 ${currentTheme.colors.textAccent}`} />
                                    Account Information
                                </h2>
                                <p className="text-slate-400">Subscription details and server status.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Status Card */}
                                <div className={`p-5 rounded-2xl ${currentTheme.colors.cardBg} border border-white/5 relative overflow-hidden`}>
                                     <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                            <User className="w-6 h-6 text-emerald-500" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Status</div>
                                            <div className="text-lg font-bold text-white flex items-center gap-2">
                                                Active <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-0.5">{credentials.username}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Expiry Card */}
                                <div className={`p-5 rounded-2xl ${currentTheme.colors.cardBg} border border-white/5 relative overflow-hidden`}>
                                     <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                            <Calendar className="w-6 h-6 text-blue-500" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Expires</div>
                                            <div className="text-lg font-bold text-white">Dec 31, 2025</div>
                                            <div className="text-xs text-slate-500 mt-0.5">245 Days Remaining</div>
                                        </div>
                                    </div>
                                </div>

                                 {/* Connection Card */}
                                 <div className={`p-5 rounded-2xl ${currentTheme.colors.cardBg} border border-white/5 relative overflow-hidden`}>
                                     <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                            <Activity className="w-6 h-6 text-purple-500" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Connections</div>
                                            <div className="text-lg font-bold text-white">1 / 3 Active</div>
                                            <div className="text-xs text-slate-500 mt-0.5">Max allowed devices</div>
                                        </div>
                                    </div>
                                </div>

                                 {/* Server Card */}
                                 <div className={`p-5 rounded-2xl ${currentTheme.colors.cardBg} border border-white/5 relative overflow-hidden`}>
                                     <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                            <Server className="w-6 h-6 text-orange-500" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Server DNS</div>
                                            <div className="text-lg font-bold text-white truncate">{credentials.url || 'http://dns.provider.com:3330'}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">Port 3330</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-white mb-2 flex items-center">
                                <Palette className={`w-6 h-6 mr-3 ${currentTheme.colors.textAccent}`} />
                                Appearance
                            </h2>
                            <p className="text-slate-400">Customize the look and feel of your player.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {APP_THEMES.map(theme => (
                                <div 
                                    key={theme.id}
                                    onClick={() => setCurrentTheme(theme)}
                                    className={`
                                        cursor-pointer rounded-2xl p-6 border-2 transition-all relative overflow-hidden group
                                        ${theme.id === currentTheme.id ? `border-${theme.colors.borderAccent.split('-')[1]}-${theme.colors.borderAccent.split('-')[2]} ${theme.colors.cardBg}` : 'border-transparent bg-slate-800/50 hover:bg-slate-800'}
                                    `}
                                >
                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                        <span className="font-bold text-lg text-white">{theme.name}</span>
                                        {theme.id === currentTheme.id && <Check className={`w-6 h-6 ${theme.colors.textAccent}`} />}
                                    </div>
                                    
                                    <div className="flex gap-2 mb-4 relative z-10">
                                        <div className={`w-8 h-8 rounded-full ${theme.colors.bgAccent}`}></div>
                                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${theme.colors.gradient}`}></div>
                                        <div className={`w-8 h-8 rounded-full ${theme.colors.sidebar} border border-white/10`}></div>
                                    </div>

                                    {/* Theme Preview Background */}
                                    <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${theme.colors.gradient} group-hover:opacity-30 transition-opacity`}></div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/5">
                            <h3 className="text-lg font-bold text-white mb-4">Application Settings</h3>
                            <div className="space-y-4">
                                {installPrompt && (
                                  <div className={`flex items-center justify-between p-4 rounded-xl bg-gradient-to-r ${currentTheme.colors.gradient} shadow-lg shadow-cyan-900/10`}>
                                      <div>
                                          <div className="font-bold text-white flex items-center gap-2"><Smartphone className="w-4 h-4" /> Android App</div>
                                          <div className="text-xs text-white/80">Install StreamGenie on your device for the best experience.</div>
                                      </div>
                                      <button onClick={handleInstallClick} className="text-sm bg-white text-slate-900 hover:bg-white/90 px-4 py-2 rounded-lg font-bold transition-colors">Install Now</button>
                                  </div>
                                )}
                                <div className="flex items-center justify-between p-4 rounded-xl bg-black/20">
                                    <div>
                                        <div className="font-medium text-white">Stream Quality</div>
                                        <div className="text-xs text-slate-500">Preferred playback resolution</div>
                                    </div>
                                    <select 
                                        value={preferredQuality}
                                        onChange={(e) => setPreferredQuality(e.target.value)}
                                        className="bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 outline-none"
                                    >
                                        <option value="Auto">Auto</option>
                                        <option value="480p">480p (640 x 480)</option>
                                        <option value="720p">720p (1280 x 720)</option>
                                        <option value="1080p">1080p (1920 x 1080)</option>
                                        <option value="4K">4K (3840 x 2160)</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-xl bg-black/20">
                                    <div>
                                        <div className="font-medium text-white">EPG Refresh Rate</div>
                                        <div className="text-xs text-slate-500">How often program data updates</div>
                                    </div>
                                    <select 
                                        value={epgRefreshInterval}
                                        onChange={(e) => setEpgRefreshInterval(Number(e.target.value))}
                                        className="bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 outline-none"
                                    >
                                        <option value={1}>Every 1 minute</option>
                                        <option value={5}>Every 5 minutes</option>
                                        <option value={15}>Every 15 minutes</option>
                                        <option value={30}>Every 30 minutes</option>
                                        <option value={60}>Every hour</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-xl bg-black/20">
                                    <div>
                                        <div className="font-medium text-white">Parental Control</div>
                                        <div className="text-xs text-slate-500">Pin protect adult content</div>
                                    </div>
                                    <button className="text-sm bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-white transition-colors">Setup PIN</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element");
}
const root = createRoot(rootElement);
root.render(<App />);

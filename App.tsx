
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { User, Lock, Server, PlayCircle, Search, AlertCircle, Sparkles, Tv, Play, Info, Heart, Wifi, Check, Palette, Trophy, Calendar, Download, Smartphone, ShieldCheck, Activity, List, Link as LinkIcon, Edit3, Loader2, ImageOff, ChevronDown, ArrowLeft } from 'lucide-react';

import VideoPlayer from './components/VideoPlayer';
import Sidebar from './components/Sidebar';
import { LoginCredentials, StreamItem, StreamCategory, AppView, StreamType, AppTheme, EPGProgram, XtreamLiveStream, XtreamVodStream, XtreamSeriesStream } from './types';
import { MOCK_CATEGORIES, MOCK_STREAMS, APP_THEMES } from './constants';
import { getAIRecommendations } from './services/geminiService';
import { authenticateUser, fetchXtreamData, mapLiveStreamToItem, mapVodStreamToItem, mapSeriesStreamToItem } from './services/iptvService';

// --- Components ---

// 1. Image With Fallback (Fixes broken icons)
const ImageWithFallback: React.FC<{ src?: string; alt: string; className?: string; type: StreamType }> = ({ src, alt, className, type }) => {
    const [hasError, setHasError] = useState(false);
    
    // Reset error state if src changes
    useEffect(() => { setHasError(false); }, [src]);

    if (!src || hasError) {
        return (
            <div className={`${className} flex items-center justify-center bg-white/5 border border-white/10`}>
                {type === StreamType.LIVE ? <Tv className="w-1/3 h-1/3 text-slate-600" /> : <PlayCircle className="w-1/3 h-1/3 text-slate-600" />}
            </div>
        );
    }

    return (
        <img 
            src={src} 
            alt={alt} 
            className={className} 
            onError={() => setHasError(true)} 
            loading="lazy" 
        />
    );
};

const App: React.FC = () => {
  // --- State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('DASHBOARD');
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(APP_THEMES[0]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Data State
  const [categories, setCategories] = useState<StreamCategory[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [visibleStreamLimit, setVisibleStreamLimit] = useState(48); // PAGINATION LIMIT
  
  // User Preferences
  const [favorites, setFavorites] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('genie_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const toggleFavorite = (streamId: number) => {
    setFavorites(prev => 
      prev.includes(streamId) ? prev.filter(id => id !== streamId) : [...prev, streamId]
    );
  };

  // Login Form
  const [loginMethod, setLoginMethod] = useState<'XTREAM' | 'M3U'>('XTREAM');
  const [credentials, setCredentials] = useState<LoginCredentials>({ name: '', url: '', username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Selection
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStream, setSelectedStream] = useState<StreamItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI Extras
  const [heroImage, setHeroImage] = useState<string>('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [seriesAlert, setSeriesAlert] = useState<string | null>(null);

  // --- Effects ---

  useEffect(() => {
    localStorage.setItem('genie_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
      const handleBeforeInstallPrompt = (e: any) => {
          e.preventDefault();
          setInstallPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = () => {
      if (installPrompt) installPrompt.prompt();
  };

  useEffect(() => {
     const movies = streams.filter(s => s.stream_type === StreamType.MOVIE);
     if (movies.length > 0) {
         setHeroImage(movies[Math.floor(Math.random() * movies.length)].stream_icon || '');
     }
  }, [streams]);

  // Reset pagination when filters change
  useEffect(() => {
      setVisibleStreamLimit(48);
  }, [currentView, selectedCategory, searchTerm]);

  // Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    setLoadingMessage('Initializing Neural Link...');

    if (loginMethod === 'XTREAM') {
        if (!credentials.username || !credentials.password || !credentials.url) {
            setLoginError('Credentials incomplete.');
            setIsLoggingIn(false);
            return;
        }

        let serverUrl = credentials.url.trim();
        if (!/^https?:\/\//i.test(serverUrl)) serverUrl = `http://${serverUrl}`;
        serverUrl = serverUrl.replace(/\/$/, '');
        const finalCredentials = { ...credentials, url: serverUrl };
        setCredentials(finalCredentials);

        try {
            const authResponse = await authenticateUser(finalCredentials);
            if (!authResponse) throw new Error('Handshake failed.');

            setLoadingMessage('Downloading Matrix...');
            const [liveCats, liveStreams, vodCats, vodStreams, seriesCats, seriesStreams] = await Promise.all([
                fetchXtreamData(finalCredentials, 'get_live_categories'),
                fetchXtreamData(finalCredentials, 'get_live_streams'),
                fetchXtreamData(finalCredentials, 'get_vod_categories'),
                fetchXtreamData(finalCredentials, 'get_vod_streams'),
                fetchXtreamData(finalCredentials, 'get_series_categories'),
                fetchXtreamData(finalCredentials, 'get_series')
            ]);

            setLoadingMessage('Parsing Data Streams...');
            
            const allCats: StreamCategory[] = [...liveCats, ...vodCats, ...seriesCats];
            const allStreams = [
                ...liveStreams.map((s: XtreamLiveStream) => mapLiveStreamToItem(s, finalCredentials)),
                ...vodStreams.map((s: XtreamVodStream) => mapVodStreamToItem(s, finalCredentials)),
                ...seriesStreams.map((s: XtreamSeriesStream) => mapSeriesStreamToItem(s))
            ];

            setCategories(allCats);
            setStreams(allStreams);
            setIsAuthenticated(true);
            setCurrentView('DASHBOARD');
            
        } catch (err: any) {
            console.error("Login Error:", err);
            let message = 'Connection severed.';
            const errorMessage = err.message || '';
            
            if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
                const isHttps = window.location.protocol === 'https:';
                const isHttpTarget = finalCredentials.url.toLowerCase().startsWith('http:');
                if (isHttps && isHttpTarget) {
                    message = 'Security Protocol Mismatch: Cannot access insecure HTTP server from HTTPS app. Use a browser that allows mixed content or find an HTTPS provider URL.';
                } else {
                    message = 'Network Blocked: CORS restriction. The server is refusing the connection.';
                }
            } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
                message = 'Access Denied: Invalid Identity.';
            }

            setLoginError(message);
        } finally {
            setIsLoggingIn(false);
            setLoadingMessage('');
        }
    }
  };

  const loadDemo = () => {
    setIsLoggingIn(true);
    setLoadingMessage('Simulating Environment...');
    setTimeout(() => {
        setCredentials({ name: 'Demo Mode', url: 'http://demo.genie.tv', username: 'demo', password: 'demo' });
        setCategories(MOCK_CATEGORIES);
        setStreams(MOCK_STREAMS);
        setIsAuthenticated(true);
        setCurrentView('DASHBOARD');
        setIsLoggingIn(false);
    }, 1200);
  };

  // Safe Stream Selection
  const handleStreamClick = (stream: StreamItem) => {
      if (stream.stream_type === StreamType.SERIES) {
          setSeriesAlert("Series browser is currently under maintenance. Please try Movies or Live TV.");
          setTimeout(() => setSeriesAlert(null), 3000);
          return;
      }
      setSelectedStream(stream);
  };

  // --- Filter & Pagination Logic ---
  
  const filteredStreams = useMemo(() => {
    let typeFilter = '';
    if (currentView === 'LIVE') typeFilter = StreamType.LIVE;
    if (currentView === 'MOVIES') typeFilter = StreamType.MOVIE;
    if (currentView === 'SERIES') typeFilter = StreamType.SERIES;
    
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

  const visibleStreams = useMemo(() => {
      return filteredStreams.slice(0, visibleStreamLimit);
  }, [filteredStreams, visibleStreamLimit]);

  // Active Categories for current view
  const activeCategories = useMemo(() => {
     if (currentView === 'FAVORITES' || currentView === 'DASHBOARD') return [];
     let typeFilter = '';
     if (currentView === 'LIVE') typeFilter = StreamType.LIVE;
     if (currentView === 'MOVIES') typeFilter = StreamType.MOVIE;
     if (currentView === 'SERIES') typeFilter = StreamType.SERIES;
     
     // Only show categories that have items
     const validCatIds = new Set(streams.filter(s => s.stream_type === typeFilter).map(s => s.category_id));
     return categories.filter(c => validCatIds.has(c.category_id));
  }, [categories, streams, currentView]);

  // --- Render ---

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen ${currentTheme.colors.background} flex items-center justify-center p-4 relative overflow-hidden font-sans`}>
        {/* Animated Cyberpunk Background */}
        <div className="absolute inset-0">
            <div className={`absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.15),transparent_50%)]`}></div>
            <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent"></div>
            {/* Grid Lines */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
        </div>

        <div className="w-full max-w-md bg-black/40 backdrop-blur-2xl p-8 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(6,182,212,0.15)] z-10 relative overflow-hidden">
            {/* Top Glow Border */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${currentTheme.colors.gradient}`}></div>

            <div className="text-center mb-8 relative">
                <div className={`w-20 h-20 mx-auto mb-6 relative group`}>
                     <div className={`absolute inset-0 bg-gradient-to-tr ${currentTheme.colors.gradient} rounded-2xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-1000`}></div>
                     <div className="absolute inset-0 bg-black/80 rounded-2xl border border-white/10 flex items-center justify-center">
                        <Tv className="text-cyan-400 w-10 h-10" />
                     </div>
                </div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tighter">GENIE<span className="text-cyan-400">TV</span></h1>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-[0.3em]">Next Gen Player</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
                {[
                    { label: 'Friendly Name', icon: Edit3, val: credentials.name, set: (v:string)=>setCredentials({...credentials, name: v}), type:'text', ph: 'My Playlist' },
                    { label: 'Username', icon: User, val: credentials.username, set: (v:string)=>setCredentials({...credentials, username: v}), type:'text', ph: 'Username' },
                    { label: 'Password', icon: Lock, val: credentials.password, set: (v:string)=>setCredentials({...credentials, password: v}), type:'password', ph: '••••••••' },
                    { label: 'Server URL', icon: Server, val: credentials.url, set: (v:string)=>setCredentials({...credentials, url: v}), type:'text', ph: 'http://provider.com:8080' },
                ].map((field, i) => (
                    <div key={i} className="space-y-1.5 group">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 group-focus-within:text-cyan-400 transition-colors">{field.label}</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <field.icon className="h-4 w-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                            </div>
                            <input 
                                type={field.type}
                                value={field.val}
                                onChange={(e) => field.set(e.target.value)}
                                className={`block w-full pl-10 pr-4 py-3.5 bg-black/50 border border-white/5 rounded-xl text-sm text-white placeholder-slate-700 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all`}
                                placeholder={field.ph}
                            />
                        </div>
                    </div>
                ))}

                {loginError && (
                    <div className="flex items-start text-red-400 text-xs bg-red-500/5 p-3 rounded-lg border border-red-500/20 backdrop-blur-sm">
                        <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                        <span>{loginError}</span>
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={isLoggingIn}
                    className={`w-full bg-gradient-to-r ${currentTheme.colors.gradient} hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] text-white font-bold py-4 rounded-xl shadow-lg transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center relative overflow-hidden group`}
                >
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
                    {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : 'INITIALIZE'}
                </button>
            </form>

            <div className="mt-8 text-center pt-6 border-t border-white/5">
                <button onClick={loadDemo} className="text-xs text-slate-600 hover:text-cyan-400 transition-colors tracking-wider uppercase">
                    Load Simulation Data
                </button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen ${currentTheme.colors.background} text-white overflow-hidden font-sans transition-colors duration-500`}>
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
         <div className={`absolute top-[-20%] left-[-10%] w-[50%] h-[50%] ${currentTheme.colors.bgAccent} opacity-[0.03] blur-[150px] rounded-full`}></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600 opacity-[0.03] blur-[150px] rounded-full"></div>
      </div>

      <Sidebar 
          currentView={currentView} 
          onChangeView={(v) => { setCurrentView(v); setSelectedCategory(null); setSelectedStream(null); }} 
          onLogout={() => { setIsAuthenticated(false); setStreams([]); }} 
          theme={currentTheme}
          showInstall={!!installPrompt}
          onInstall={handleInstallClick}
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 pb-20 md:pb-0">
        
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-6 border-b border-white/5 bg-black/20 backdrop-blur-md flex-shrink-0">
            <div>
                <h2 className="text-lg md:text-xl font-bold text-white tracking-widest uppercase flex items-center gap-2">
                    {currentView.replace('_', ' ')}
                    {currentView === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_red] animate-pulse"></span>}
                </h2>
                <div className="text-[10px] text-cyan-400/60 font-mono hidden md:block">
                   SYS.STATUS: ONLINE // {filteredStreams.length} SIGNALS DETECTED
                </div>
            </div>
            
            <div className="flex items-center space-x-4">
                 {(['LIVE', 'MOVIES', 'SERIES', 'FAVORITES'].includes(currentView)) && (
                    <div className="relative group">
                        <Search className={`absolute left-3 top-2.5 text-slate-500 w-4 h-4 group-focus-within:${currentTheme.colors.textAccent} transition-colors`} />
                        <input 
                            type="text" 
                            placeholder="SEARCH FREQUENCY..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`bg-black/40 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-cyan-500/50 focus:bg-black/60 transition-all w-32 focus:w-64 text-white uppercase tracking-wider`}
                        />
                    </div>
                )}
                
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-800 to-black border border-white/10 flex items-center justify-center shadow-lg">
                    <User className="w-4 h-4 text-slate-400" />
                </div>
            </div>
        </header>

        {/* Categories Bar (Horizontal Scroll) */}
        {activeCategories.length > 0 && !selectedStream && (
            <div className="h-14 flex-shrink-0 border-b border-white/5 bg-black/10 backdrop-blur-sm overflow-x-auto custom-scrollbar flex items-center px-4 gap-2">
                <button 
                    onClick={() => setSelectedCategory(null)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${selectedCategory === null ? `${currentTheme.colors.bgAccent} text-white border-transparent shadow-[0_0_15px_rgba(6,182,212,0.3)]` : 'border-white/5 text-slate-400 hover:bg-white/5'}`}
                >
                    ALL
                </button>
                {activeCategories.map(cat => (
                    <button 
                        key={cat.category_id}
                        onClick={() => setSelectedCategory(cat.category_id)}
                        className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${selectedCategory === cat.category_id ? `${currentTheme.colors.bgAccent} text-white border-transparent shadow-[0_0_15px_rgba(6,182,212,0.3)]` : 'border-white/5 text-slate-400 hover:bg-white/5'}`}
                    >
                        {cat.category_name}
                    </button>
                ))}
            </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 relative">
            
            {/* Series Alert Toast */}
            {seriesAlert && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-3 rounded-xl backdrop-blur-md shadow-2xl flex items-center animate-bounce">
                    <AlertCircle className="w-5 h-5 mr-3" />
                    {seriesAlert}
                </div>
            )}

            {/* If Stream Selected -> Show Player */}
            {selectedStream ? (
                <div className="h-full flex flex-col animate-fadeIn">
                    <button onClick={() => setSelectedStream(null)} className="flex items-center text-slate-400 hover:text-white mb-4 group w-fit">
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        <span className="uppercase text-xs font-bold tracking-widest">Return to Grid</span>
                    </button>
                    
                    <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
                        <div className="flex-1 relative bg-black rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10">
                            <VideoPlayer 
                                src={selectedStream.direct_source || ''} 
                                poster={selectedStream.stream_icon}
                                autoPlay={true}
                            />
                        </div>
                        <div className="lg:w-80 flex-shrink-0 space-y-4 overflow-y-auto">
                            <div className={`${currentTheme.colors.cardBg} p-5 rounded-2xl border border-white/5`}>
                                <h1 className="text-xl font-bold text-white mb-2 leading-tight">{selectedStream.name}</h1>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest mb-4">
                                    <span className="bg-white/10 px-2 py-0.5 rounded">{selectedStream.stream_type}</span>
                                    {selectedStream.rating && <span>Rating: {selectedStream.rating}</span>}
                                </div>
                                <button 
                                    onClick={() => toggleFavorite(selectedStream.stream_id)}
                                    className={`w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all ${favorites.includes(selectedStream.stream_id) ? 'bg-pink-500/20 border-pink-500/50 text-pink-400' : 'border-white/10 hover:bg-white/5 text-slate-300'}`}
                                >
                                    <Heart className={`w-4 h-4 ${favorites.includes(selectedStream.stream_id) ? 'fill-current' : ''}`} />
                                    <span className="text-xs font-bold uppercase">{favorites.includes(selectedStream.stream_id) ? 'Favorited' : 'Add to Favorites'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Grid View */
                <>
                    {/* Dashboard Hero (Only on Dashboard view) */}
                    {currentView === 'DASHBOARD' && (
                        <div className="relative w-full h-64 md:h-80 rounded-3xl overflow-hidden mb-8 group border border-white/10">
                            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-[10s] group-hover:scale-110" style={{ backgroundImage: `url(${heroImage || 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop'})` }} />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#050510] via-[#050510]/60 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 p-8">
                                <span className={`px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 inline-block backdrop-blur-sm`}>Featured Content</span>
                                <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight drop-shadow-xl">WELCOME TO THE FUTURE</h1>
                                <button onClick={() => setCurrentView('LIVE')} className={`bg-white text-black px-8 py-3 rounded-full font-bold uppercase tracking-wider text-xs hover:bg-cyan-400 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.3)]`}>
                                    Start Streaming
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {visibleStreams.map((stream) => (
                            <div 
                                key={stream.stream_id} 
                                onClick={() => handleStreamClick(stream)}
                                className={`group relative aspect-[2/3] md:aspect-video rounded-xl overflow-hidden cursor-pointer ${currentTheme.colors.cardBg} border border-white/5 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all duration-300`}
                            >
                                <ImageWithFallback 
                                    src={stream.stream_icon} 
                                    alt={stream.name} 
                                    type={stream.stream_type as StreamType}
                                    className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" 
                                />
                                
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-90"></div>
                                
                                <div className="absolute bottom-0 left-0 p-3 w-full">
                                    <h3 className="text-white text-sm font-bold truncate pr-2 leading-tight group-hover:text-cyan-400 transition-colors">{stream.name}</h3>
                                    {stream.stream_type === StreamType.LIVE && (
                                        <div className="flex items-center mt-1">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 shadow-[0_0_5px_green]"></div>
                                            <span className="text-[9px] text-slate-400 uppercase tracking-wider">Live</span>
                                        </div>
                                    )}
                                </div>

                                {/* Play Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20 backdrop-blur-[2px]">
                                    <div className="w-10 h-10 rounded-full bg-cyan-500 text-black flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.6)] transform scale-50 group-hover:scale-100 transition-transform">
                                        <Play className="w-4 h-4 fill-current ml-0.5" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination Load More */}
                    {visibleStreams.length < filteredStreams.length && (
                        <div className="flex justify-center mt-8 pb-8">
                            <button 
                                onClick={() => setVisibleStreamLimit(prev => prev + 48)}
                                className="flex items-center px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
                            >
                                <ChevronDown className="w-4 h-4 mr-2" />
                                Load More ({filteredStreams.length - visibleStreams.length} remaining)
                            </button>
                        </div>
                    )}

                    {filteredStreams.length === 0 && (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-500">
                            <Search className="w-12 h-12 mb-4 opacity-20" />
                            <p className="uppercase tracking-widest text-xs">No signals found in this sector</p>
                        </div>
                    )}
                </>
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

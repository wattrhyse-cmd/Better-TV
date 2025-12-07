
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { User, Lock, Server, PlayCircle, Search, AlertCircle, Sparkles, Send, Tv, Play, Info, ArrowLeft, Star, Clock, Wifi, Check, Palette, Trophy, Calendar, Captions, Download, Smartphone, Heart, RefreshCw, CloudDownload } from 'lucide-react';

import VideoPlayer from './components/VideoPlayer';
import Sidebar from './components/Sidebar';
import { LoginCredentials, StreamItem, StreamCategory, AppView, StreamType, AppTheme, EPGProgram } from './types';
import { MOCK_CATEGORIES, MOCK_STREAMS, APP_THEMES } from './constants';
import { getAIRecommendations } from './services/geminiService';

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
  const [credentials, setCredentials] = useState<LoginCredentials>({ url: '', username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
     const movies = MOCK_STREAMS.filter(s => s.stream_type === StreamType.MOVIE);
     if (movies.length > 0) {
         setHeroImage(movies[Math.floor(Math.random() * movies.length)].stream_icon || '');
     }
  }, [streams]);

  // Mock Login Process
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    setTimeout(() => {
      if (credentials.username && credentials.password && credentials.url) {
        completeLogin();
      } else {
        setLoginError('Please fill in all fields');
        setIsLoggingIn(false);
      }
    }, 1500);
  };

  const loadDemo = () => {
    setIsLoggingIn(true);
    setTimeout(() => {
        setCredentials({
            url: 'http://demo-iptv.com',
            username: 'demo_user',
            password: 'demo_password'
        });
        completeLogin();
    }, 1000);
  };

  const completeLogin = () => {
    setIsAuthenticated(true);
    setCategories(MOCK_CATEGORIES);
    setStreams(MOCK_STREAMS);
    setIsLoggingIn(false);
    setCurrentView('DASHBOARD');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCredentials({ url: '', username: '', password: '' });
    setSelectedStream(null);
    setCurrentView('LOGIN');
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

        <div className="w-full max-w-md bg-white/5 backdrop-blur-2xl p-10 rounded-3xl border border-white/10 shadow-2xl z-10 relative">
            <div className="text-center mb-10">
                <div className={`w-20 h-20 bg-gradient-to-tr ${currentTheme.colors.gradient} rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-xl transform rotate-3 hover:rotate-0 transition-all duration-500`}>
                    <Tv className="text-white w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">StreamGenie</h1>
                <p className="text-slate-400 text-sm font-medium">Next-Generation IPTV Experience</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Server URL</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Server className={`h-5 w-5 text-slate-500 group-focus-within:${currentTheme.colors.textAccent} transition-colors`} />
                        </div>
                        <input 
                            type="url" 
                            className={`block w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-sm placeholder-slate-500 focus:outline-none focus:${currentTheme.colors.borderAccent} focus:ring-1 focus:ring-opacity-50 text-white transition-all`} 
                            placeholder="http://provider.com:8080"
                            value={credentials.url}
                            onChange={(e) => setCredentials({...credentials, url: e.target.value})}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Username</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <User className={`h-5 w-5 text-slate-500 group-focus-within:${currentTheme.colors.textAccent} transition-colors`} />
                        </div>
                        <input 
                            type="text" 
                            className={`block w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-sm placeholder-slate-500 focus:outline-none focus:${currentTheme.colors.borderAccent} focus:ring-1 focus:ring-opacity-50 text-white transition-all`} 
                            placeholder="Username"
                            value={credentials.username}
                            onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Lock className={`h-5 w-5 text-slate-500 group-focus-within:${currentTheme.colors.textAccent} transition-colors`} />
                        </div>
                        <input 
                            type="password" 
                            className={`block w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-sm placeholder-slate-500 focus:outline-none focus:${currentTheme.colors.borderAccent} focus:ring-1 focus:ring-opacity-50 text-white transition-all`} 
                            placeholder="••••••••"
                            value={credentials.password}
                            onChange={(e) => setCredentials({...credentials, password: e.target.value})}
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
                    className={`w-full bg-gradient-to-r ${currentTheme.colors.gradient} hover:opacity-90 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed`}
                >
                    {isLoggingIn ? 'Authenticating...' : 'Secure Login'}
                </button>
            </form>

            <div className="mt-8 text-center">
                <button 
                    onClick={loadDemo}
                    className={`text-xs text-slate-500 hover:${currentTheme.colors.textAccent} transition-colors`}
                >
                    Try Demo Account
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

            {/* --- LIVE TV & FAVORITES VIEW (Split Layout for Live, Grid for others) --- */}
            {(currentView === 'LIVE' || (currentView === 'FAVORITES' && (selectedStream || filteredStreams.some(s => s.stream_type === StreamType.LIVE)))) && (
                <div className="flex h-full flex-col md:flex-row">
                    {/* Categories - Hidden in Favorites view or if stream selected */}
                    {currentView !== 'FAVORITES' && (
                        <div className={`w-full md:w-64 ${currentTheme.colors.sidebar} border-r border-slate-800 overflow-y-auto flex-shrink-0 ${selectedStream ? 'hidden md:block' : ''}`}>
                            <div className="p-4">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Categories</h3>
                                <div className="flex flex-row overflow-x-auto gap-2 md:block md:space-y-1 pb-2 md:pb-0">
                                    <button
                                        onClick={() => setSelectedCategory(null)}
                                        className={`whitespace-nowrap md:whitespace-normal w-auto md:w-full text-left px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${!selectedCategory ? `bg-gradient-to-r ${currentTheme.colors.gradient} text-white shadow-lg` : 'text-slate-400 hover:bg-slate-800 hover:text-white bg-slate-800/50 md:bg-transparent'}`}
                                    >
                                        All Channels
                                    </button>
                                    {activeCategories.map(cat => (
                                        <button
                                            key={cat.category_id}
                                            onClick={() => setSelectedCategory(cat.category_id)}
                                            className={`whitespace-nowrap md:whitespace-normal w-auto md:w-full text-left px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${selectedCategory === cat.category_id ? `bg-gradient-to-r ${currentTheme.colors.gradient} text-white shadow-lg` : 'text-slate-400 hover:bg-slate-800 hover:text-white bg-slate-800/50 md:bg-transparent'}`}
                                        >
                                            {cat.category_name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Channel List / Favorites List */}
                    <div className={`${selectedStream ? 'hidden xl:block w-96' : 'flex-1'} ${currentTheme.colors.cardBg} border-r border-slate-800 overflow-y-auto flex-shrink-0 transition-all`}>
                         <div className="p-2">
                             {/* If Favorites view, maybe add a header */}
                             {currentView === 'FAVORITES' && filteredStreams.length === 0 && (
                                 <div className="text-center p-10 text-slate-500">
                                     <Heart className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                     <p>No favorites added yet.</p>
                                     <button onClick={() => setCurrentView('LIVE')} className="mt-4 text-sm text-cyan-400 hover:underline">Browse Channels</button>
                                 </div>
                             )}

                             {filteredStreams.map(stream => {
                                // Generate mini-epg for this item
                                const epg = generateMockEPG(stream, currentTime);
                                const totalDuration = epg.current.end.getTime() - epg.current.start.getTime();
                                const elapsed = currentTime.getTime() - epg.current.start.getTime();
                                const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
                                const isFav = favorites.includes(stream.stream_id);

                                return (
                                <div 
                                    key={stream.stream_id}
                                    onClick={() => setSelectedStream(stream)}
                                    className={`relative p-4 mb-2 rounded-xl cursor-pointer transition-all group ${selectedStream?.stream_id === stream.stream_id ? `bg-slate-700/50 border-l-4 ${currentTheme.colors.borderAccent}` : 'hover:bg-slate-700/30 border-l-4 border-transparent'}`}
                                >
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-slate-700">
                                            <img src={stream.stream_icon} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                            <span className="text-[10px] text-slate-600 font-bold absolute">TV</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h4 className={`font-bold text-sm truncate ${selectedStream?.stream_id === stream.stream_id ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{stream.name}</h4>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(stream.stream_id); }}
                                                    className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${isFav ? 'text-pink-500' : 'text-slate-600 hover:text-pink-500'}`}
                                                >
                                                    <Heart size={14} className={isFav ? 'fill-current' : ''} />
                                                </button>
                                            </div>
                                            <div className="flex items-center text-[11px] text-slate-500 mt-0.5">
                                                <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 mr-2">{stream.num}</span>
                                                <span className={`${currentTheme.colors.textAccent}`}>Now:</span> <span className="ml-1 truncate max-w-[120px]">{epg.current.title}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* EPG Progress Bar */}
                                    <div className="mt-1">
                                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                            <span>{formatTime(epg.current.start)}</span>
                                            <span>{formatTime(epg.current.end)}</span>
                                        </div>
                                        <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                                            <div className={`h-full ${currentTheme.colors.bgAccent}`} style={{ width: `${progress}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                             )})}
                        </div>
                    </div>
                    
                    {/* Player */}
                    {selectedStream ? (
                        <div className="flex-1 bg-black flex flex-col relative fixed inset-0 z-50 md:static md:z-auto">
                            <div className="flex-1 relative bg-black">
                                <VideoPlayer 
                                    key={selectedStream.stream_id} 
                                    src={selectedStream.direct_source || ''} 
                                    poster={selectedStream.stream_icon}
                                    subtitles={selectedStream.subtitles}
                                    onNext={handleNextStream}
                                    isFavorite={favorites.includes(selectedStream.stream_id)}
                                    onToggleFavorite={() => toggleFavorite(selectedStream.stream_id)}
                                />
                                {/* Mobile Back Button */}
                                <button 
                                    onClick={() => setSelectedStream(null)}
                                    className="absolute top-4 left-4 z-40 bg-black/50 text-white p-2 rounded-full md:hidden backdrop-blur-md"
                                >
                                    <ArrowLeft size={24} />
                                </button>
                            </div>
                            
                            {/* Player Info Panel (EPG Detail) */}
                            {selectedStreamEPG && (
                                <div className={`h-auto ${currentTheme.colors.sidebar} p-6 border-t border-slate-800 hidden md:block`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-2">{selectedStream.name}</h2>
                                            <div className="flex items-center gap-3 text-sm text-slate-400">
                                                <span className={`${currentTheme.colors.iconBg} ${currentTheme.colors.textAccent} px-2 py-0.5 rounded text-xs font-bold uppercase`}>Live</span>
                                                <span>1080p</span>
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Now Playing</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-3xl font-bold ${currentTheme.colors.textAccent}`}>{formatTime(currentTime)}</div>
                                            <div className="text-slate-500 text-xs uppercase font-bold tracking-wider">{currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="md:col-span-2 p-4 rounded-xl bg-slate-800/50 border border-white/5">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-bold text-white text-lg">{selectedStreamEPG.current.title}</h3>
                                                <span className="text-xs text-slate-400 bg-black/30 px-2 py-1 rounded">
                                                    {formatTime(selectedStreamEPG.current.start)} - {formatTime(selectedStreamEPG.current.end)}
                                                </span>
                                            </div>
                                            <p className="text-slate-400 text-sm leading-relaxed">{selectedStreamEPG.current.description}</p>
                                            <div className="mt-4 h-1.5 bg-slate-700 rounded-full overflow-hidden w-full">
                                                <div 
                                                    className={`h-full ${currentTheme.colors.bgAccent}`} 
                                                    style={{ 
                                                        width: `${Math.min(100, Math.max(0, ((currentTime.getTime() - selectedStreamEPG.current.start.getTime()) / (selectedStreamEPG.current.end.getTime() - selectedStreamEPG.current.start.getTime())) * 100))}%` 
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-xl bg-slate-800/30 border border-white/5 flex flex-col justify-center">
                                            <div className="text-xs font-bold text-slate-500 uppercase mb-2">Up Next</div>
                                            <div className="flex items-center gap-2 mb-1">
                                                 <Calendar className="w-4 h-4 text-slate-400" />
                                                 <span className="font-bold text-white">{selectedStreamEPG.next.title}</span>
                                            </div>
                                            <div className="text-xs text-slate-400 ml-6">
                                                {formatTime(selectedStreamEPG.next.start)} - {formatTime(selectedStreamEPG.next.end)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={`hidden md:flex flex-1 flex-col items-center justify-center text-slate-600 ${currentTheme.colors.background} p-8 text-center`}>
                            <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
                                {currentView === 'FAVORITES' ? <Heart className="w-10 h-10 opacity-30 fill-current text-pink-500" /> : <Tv className="w-10 h-10 opacity-30" />}
                            </div>
                            <h3 className="text-lg font-medium text-slate-400">
                                {currentView === 'FAVORITES' ? 'Select a favorite to watch' : 'Select a channel to start watching'}
                            </h3>
                            <p className="text-sm text-slate-500 mt-2 max-w-xs">
                                {currentView === 'FAVORITES' ? 'Add channels to your favorites list to see them here.' : 'Choose from the categories on the left to browse available channels.'}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* --- MOVIES / SERIES VIEW (Grid Layout) - AND FAVORITES GRID if VOD --- */}
            {(currentView === 'MOVIES' || currentView === 'SERIES' || (currentView === 'FAVORITES' && !filteredStreams.some(s => s.stream_type === StreamType.LIVE))) && (
                <div className="h-full flex flex-col">
                    {/* Filter Bar - Hide in Favorites */}
                    {currentView !== 'FAVORITES' && (
                        <div className="h-14 border-b border-white/5 bg-slate-900/20 flex items-center px-4 md:px-6 gap-2 md:gap-4 overflow-x-auto">
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${!selectedCategory ? `${currentTheme.colors.bgAccent} text-white` : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                            >
                                All
                            </button>
                            {activeCategories.map(cat => (
                                <button
                                    key={cat.category_id}
                                    onClick={() => setSelectedCategory(cat.category_id)}
                                    className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedCategory === cat.category_id ? `${currentTheme.colors.bgAccent} text-white` : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                                >
                                    {cat.category_name}
                                </button>
                            ))}
                        </div>
                    )}

                    {selectedStream ? (
                        /* Detail / Player View for VOD */
                        <div className={`flex-1 ${currentTheme.colors.sidebar} overflow-y-auto fixed inset-0 z-50 md:static md:z-auto`}>
                            <div className="relative h-[40vh] md:h-[50vh] w-full bg-black">
                                <div className="absolute inset-0">
                                    <VideoPlayer 
                                        key={selectedStream.stream_id} 
                                        src={selectedStream.direct_source || ''} 
                                        poster={selectedStream.stream_icon} 
                                        onProgress={handleStreamProgress}
                                        subtitles={selectedStream.subtitles}
                                        onNext={handleNextStream}
                                        isFavorite={favorites.includes(selectedStream.stream_id)}
                                        onToggleFavorite={() => toggleFavorite(selectedStream.stream_id)}
                                    />
                                </div>
                                <button 
                                    onClick={() => setSelectedStream(null)}
                                    className="absolute top-4 left-4 z-40 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-md transition-all"
                                >
                                    <ArrowLeft className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-4 md:p-8 max-w-5xl mx-auto">
                                <div className="flex flex-col md:flex-row gap-8">
                                    <img src={selectedStream.stream_icon} className="w-full md:w-48 h-auto md:h-72 rounded-xl object-cover shadow-2xl shadow-black/50 hidden md:block" />
                                    <div>
                                        <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-4">{selectedStream.name}</h1>
                                        <div className="flex items-center gap-4 mb-4 md:mb-6">
                                            <span className="flex items-center text-yellow-400 font-bold"><Star className="w-4 h-4 fill-current mr-1" /> {selectedStream.rating || 'N/A'}</span>
                                            <span className="text-slate-400 text-sm">{selectedStream.stream_type === StreamType.MOVIE ? '2023 • 2h 14m' : '3 Seasons'}</span>
                                            <span className="border border-slate-600 px-2 py-0.5 rounded text-xs text-slate-300">HD</span>
                                            {selectedStream.subtitles && selectedStream.subtitles.length > 0 && (
                                                <span className="border border-slate-600 px-2 py-0.5 rounded text-xs text-slate-300 flex items-center gap-1"><Captions size={10} /> CC</span>
                                            )}
                                        </div>
                                        {/* Dynamic Progress indicator if playing */}
                                        {selectedStream.progress && selectedStream.progress > 0 && (
                                            <div className="mb-6 w-full max-w-md">
                                                <div className="flex justify-between text-xs text-slate-400 mb-1">
                                                    <span>Resume watching</span>
                                                    <span>{selectedStream.progress}% complete</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className={`h-full ${currentTheme.colors.bgAccent}`} style={{ width: `${selectedStream.progress}%` }}></div>
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-slate-300 leading-relaxed text-sm md:text-lg mb-6 md:mb-8">
                                            Experience high-definition streaming with {selectedStream.name}. 
                                            This content is streamed directly from our secure XTream Codes compatible servers.
                                            Enjoy buffer-free playback and crystal clear audio.
                                        </p>
                                        <div className="flex gap-4">
                                            <button className={`${currentTheme.colors.bgAccent} text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:opacity-90 transition-opacity w-full md:w-auto justify-center`}>
                                                <Play className="w-5 h-5 fill-current" /> {selectedStream.progress && selectedStream.progress > 0 ? 'Resume' : 'Play'}
                                            </button>
                                            <button 
                                                onClick={() => toggleFavorite(selectedStream.stream_id)}
                                                className="bg-slate-800 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors hidden md:flex"
                                            >
                                                <Heart className={`w-5 h-5 ${favorites.includes(selectedStream.stream_id) ? 'fill-pink-500 text-pink-500' : ''}`} /> 
                                                {favorites.includes(selectedStream.stream_id) ? 'Favorited' : 'Favorite'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Grid View */
                        <div className="flex-1 overflow-y-auto p-4 md:p-6">
                            {currentView === 'FAVORITES' && filteredStreams.length === 0 && (
                                 <div className="text-center p-10 text-slate-500">
                                     <Heart className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                     <p>No favorites added yet.</p>
                                     <button onClick={() => setCurrentView('MOVIES')} className="mt-4 text-sm text-cyan-400 hover:underline">Browse Movies</button>
                                 </div>
                             )}

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                                {filteredStreams.map(stream => (
                                    <div 
                                        key={stream.stream_id}
                                        onClick={() => setSelectedStream(stream)}
                                        className="group cursor-pointer flex flex-col"
                                    >
                                        <div className={`relative aspect-[2/3] rounded-xl overflow-hidden mb-3 ${currentTheme.colors.cardBg} shadow-lg group-hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-2`}>
                                            <img src={stream.stream_icon} alt={stream.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                                <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center mx-auto mb-2 transform scale-0 group-hover:scale-100 transition-transform delay-100">
                                                    <Play className="w-4 h-4 fill-current ml-0.5" />
                                                </div>
                                            </div>
                                            
                                            {/* Favorite Heart Overlay for Grid */}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); toggleFavorite(stream.stream_id); }}
                                                className="absolute top-2 right-2 bg-black/40 backdrop-blur-md p-1.5 rounded-full hover:bg-black/60 transition-colors z-10"
                                            >
                                                <Heart size={14} className={favorites.includes(stream.stream_id) ? "fill-pink-500 text-pink-500" : "text-white"} />
                                            </button>

                                            {stream.rating && (
                                                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-yellow-400 flex items-center">
                                                    <Star className="w-3 h-3 fill-current mr-0.5" /> {stream.rating}
                                                </div>
                                            )}
                                            {/* Grid Item Progress Bar */}
                                            {stream.progress && stream.progress > 0 && (
                                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700/50">
                                                    <div className={`h-full ${currentTheme.colors.bgAccent}`} style={{ width: `${stream.progress}%` }}></div>
                                                </div>
                                            )}
                                        </div>
                                        <h3 className="text-xs md:text-sm font-medium text-slate-300 truncate group-hover:text-white transition-colors">{stream.name}</h3>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- AI SEARCH VIEW --- */}
            {currentView === 'AI_SEARCH' && (
                <div className="max-w-4xl mx-auto p-4 md:p-6 flex flex-col h-full">
                    <div className={`flex-1 overflow-y-auto mb-4 md:mb-6 ${currentTheme.colors.cardBg} rounded-3xl p-6 md:p-8 border border-white/5 shadow-2xl`}>
                        {aiResponse ? (
                            <div className="flex items-start gap-4 md:gap-6 animate-fadeIn">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br ${currentTheme.colors.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                                    <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-white" />
                                </div>
                                <div className="space-y-4 flex-1">
                                    <h3 className={`font-bold text-lg ${currentTheme.colors.textAccent}`}>Genie Suggests:</h3>
                                    <div className="text-slate-300 leading-relaxed whitespace-pre-line text-sm md:text-lg">
                                        {aiResponse}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                <div className={`w-16 h-16 md:w-20 md:h-20 ${currentTheme.colors.iconBg} rounded-full flex items-center justify-center mb-6 animate-pulse`}>
                                    <Sparkles className={`w-8 h-8 md:w-10 md:h-10 ${currentTheme.colors.textAccent}`} />
                                </div>
                                <h3 className="text-xl md:text-2xl font-bold text-white mb-3">AI Content Curator</h3>
                                <p className="text-slate-400 max-w-md text-sm md:text-base">
                                    "I'm in the mood for an 80s action movie with a high rating" <br/>
                                    "Show me sports channels showing football"
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="relative group">
                        <input
                            type="text"
                            value={aiQuery}
                            onChange={(e) => setAiQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                            placeholder="Ask Genie for recommendations..."
                            className={`w-full ${currentTheme.colors.cardBg} border border-slate-700/50 rounded-2xl py-4 md:py-5 pl-6 pr-16 text-white placeholder-slate-500 focus:outline-none focus:${currentTheme.colors.borderAccent} focus:ring-1 focus:ring-opacity-50 transition-all shadow-xl text-sm md:text-base`}
                        />
                        <button 
                            onClick={handleAskAI}
                            disabled={aiLoading}
                            className={`absolute right-2 md:right-3 top-2 md:top-3 bottom-2 md:bottom-3 ${currentTheme.colors.bgAccent} hover:opacity-90 text-white p-2 md:p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed aspect-square flex items-center justify-center shadow-lg`}
                        >
                            {aiLoading ? <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4 md:w-5 md:h-5" />}
                        </button>
                    </div>
                </div>
            )}

            {/* --- UPDATES VIEW --- */}
            {currentView === 'UPDATES' && (
                <div className="h-full flex items-center justify-center p-4">
                    <div className={`w-full max-w-md ${currentTheme.colors.cardBg} p-8 rounded-3xl border border-white/5 shadow-2xl text-center relative overflow-hidden`}>
                        {/* Background Decoration */}
                        <div className={`absolute top-0 left-0 w-full h-2 ${currentTheme.colors.bgAccent}`}></div>
                        
                        <div className="mb-6 relative">
                             <div className={`w-20 h-20 mx-auto rounded-full bg-slate-800 flex items-center justify-center mb-4 relative z-10`}>
                                 {updateStatus === 'checking' || updateStatus === 'downloading' ? (
                                     <RefreshCw className={`w-10 h-10 ${currentTheme.colors.textAccent} animate-spin`} />
                                 ) : updateStatus === 'available' ? (
                                     <CloudDownload className="w-10 h-10 text-emerald-400" />
                                 ) : updateStatus === 'completed' ? (
                                     <Check className="w-10 h-10 text-emerald-400" />
                                 ) : (
                                     <RefreshCw className="w-10 h-10 text-slate-400" />
                                 )}
                             </div>
                             {updateStatus === 'downloading' && (
                                 <div className="absolute inset-0 flex items-center justify-center z-0 opacity-20">
                                     <div className={`w-24 h-24 rounded-full ${currentTheme.colors.bgAccent} animate-ping`}></div>
                                 </div>
                             )}
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">System Updates</h2>
                        
                        {updateStatus === 'idle' && (
                            <>
                                <p className="text-slate-400 mb-8">Current Version: <span className="text-white font-mono">v2.4.1</span></p>
                                <button 
                                    onClick={checkForUpdates}
                                    className={`${currentTheme.colors.bgAccent} hover:opacity-90 text-white font-bold py-3 px-8 rounded-xl transition-all w-full shadow-lg`}
                                >
                                    Check for Updates
                                </button>
                            </>
                        )}

                        {updateStatus === 'checking' && (
                            <p className="text-slate-300 animate-pulse">Checking for available updates...</p>
                        )}

                        {updateStatus === 'available' && (
                            <div className="animate-fadeIn">
                                <p className="text-emerald-400 font-bold mb-2">New Version Available!</p>
                                <p className="text-white text-xl font-bold mb-4">v2.5.0</p>
                                <ul className="text-left text-sm text-slate-400 mb-6 bg-black/20 p-4 rounded-xl space-y-2">
                                    <li className="flex items-start gap-2"><Check size={14} className="mt-1 text-emerald-500" /> Improved streaming stability</li>
                                    <li className="flex items-start gap-2"><Check size={14} className="mt-1 text-emerald-500" /> New 4K content support</li>
                                    <li className="flex items-start gap-2"><Check size={14} className="mt-1 text-emerald-500" /> Minor bug fixes</li>
                                </ul>
                                <button 
                                    onClick={startUpdate}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-xl transition-all w-full shadow-lg flex items-center justify-center gap-2"
                                >
                                    <CloudDownload size={20} /> Update Now
                                </button>
                            </div>
                        )}

                        {updateStatus === 'downloading' && (
                            <div className="animate-fadeIn">
                                <p className="text-slate-300 mb-4">Downloading update files...</p>
                                <div className="h-4 bg-slate-800 rounded-full overflow-hidden w-full mb-2">
                                    <div 
                                        className={`h-full ${currentTheme.colors.bgAccent} transition-all duration-300`} 
                                        style={{ width: `${updateProgress}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-slate-500 text-right">{Math.round(updateProgress)}%</p>
                            </div>
                        )}

                        {updateStatus === 'completed' && (
                            <div className="animate-fadeIn">
                                <p className="text-emerald-400 font-bold mb-2">Update Complete!</p>
                                <p className="text-slate-400 text-sm">Restarting application...</p>
                            </div>
                        )}
                        
                        <div className="mt-6 pt-6 border-t border-white/5">
                            <p className="text-xs text-slate-600">
                                Automatic updates ensure you always have the latest features and security patches.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* --- SETTINGS / THEMES VIEW --- */}
            {currentView === 'SETTINGS' && (
                <div className="p-4 md:p-8 h-full overflow-y-auto">
                    <div className="max-w-5xl mx-auto">
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

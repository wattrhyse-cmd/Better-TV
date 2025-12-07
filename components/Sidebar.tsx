
import React from 'react';
import { Tv, Film, MonitorPlay, Settings, LogOut, Sparkles, LayoutGrid, Download, Heart, RefreshCw } from 'lucide-react';
import { AppView, AppTheme } from '../types';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  onLogout: () => void;
  theme: AppTheme;
  showInstall: boolean;
  onInstall: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout, theme, showInstall, onInstall }) => {
  const menuItems = [
    { id: 'DASHBOARD', icon: LayoutGrid, label: 'Dashboard', color: 'text-blue-400' },
    { id: 'LIVE', icon: Tv, label: 'Live TV', color: 'text-rose-400' },
    { id: 'MOVIES', icon: Film, label: 'Movies', color: 'text-cyan-400' },
    { id: 'SERIES', icon: MonitorPlay, label: 'Series', color: 'text-purple-400' },
    { id: 'FAVORITES', icon: Heart, label: 'Favorites', color: 'text-pink-500' },
    { id: 'AI_SEARCH', icon: Sparkles, label: 'AI Curator', color: 'text-emerald-400', highlight: true },
    { id: 'UPDATES', icon: RefreshCw, label: 'Updates', color: 'text-orange-400' },
    { id: 'SETTINGS', icon: Settings, label: 'Settings', color: 'text-slate-400' },
  ];

  return (
    <>
      {/* Desktop Sidebar (lg screens) */}
      <div className={`hidden md:flex w-20 lg:w-64 h-screen ${theme.colors.sidebar} border-r border-white/5 flex-col justify-between transition-all duration-500 z-50 flex-shrink-0 backdrop-blur-2xl relative overflow-hidden shadow-[5px_0_30px_rgba(0,0,0,0.5)]`}>
        
        {/* Glow effect */}
        <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-b ${theme.colors.gradient} opacity-10 blur-3xl`}></div>

        <div className="relative z-10">
          <div className="h-24 flex flex-col items-center justify-center border-b border-white/5 mb-6">
              <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 bg-gradient-to-tr ${theme.colors.gradient} rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.3)] border border-white/20`}>
                      <Tv className="text-white w-5 h-5" />
                  </div>
                  <span className="hidden lg:block font-bold text-xl tracking-[0.2em] text-white">GENIE<span className={theme.colors.textAccent}>TV</span></span>
              </div>
          </div>

          <nav className="flex flex-col gap-3 px-4">
            {menuItems.map((item) => {
               const isActive = currentView === item.id;
               
               return (
                <button
                  key={item.id}
                  onClick={() => onChangeView(item.id as AppView)}
                  className={`
                    flex items-center p-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden
                    ${isActive 
                        ? `bg-white/10 text-white shadow-[0_0_20px_rgba(0,0,0,0.3)] border border-white/10` 
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                    }
                  `}
                >
                  {/* Active Indicator Line */}
                  {isActive && <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 ${theme.colors.bgAccent} rounded-r-full shadow-[0_0_10px_currentColor]`} />}
                  
                  <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'} ${isActive ? theme.colors.textAccent : item.color} ${item.highlight && !isActive ? 'animate-pulse' : ''}`} />
                  <span className={`hidden lg:block ml-4 font-medium text-sm tracking-wide ${isActive ? 'text-white font-bold' : ''}`}>{item.label}</span>
                  
                  {/* Subtle sweep animation on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none`} />
                </button>
               );
            })}
          </nav>
        </div>

        <div className="p-4 mb-4 space-y-3 relative z-10">
          {showInstall && (
            <button 
              onClick={onInstall}
              className={`w-full flex items-center p-3.5 rounded-xl bg-gradient-to-r ${theme.colors.gradient} text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] hover:-translate-y-0.5 transition-all duration-300 group`}
            >
              <Download className="w-5 h-5" />
              <span className="hidden lg:block ml-3 font-bold text-sm uppercase tracking-wider">Install App</span>
            </button>
          )}

          <button 
            onClick={onLogout}
            className="w-full flex items-center p-3.5 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-transparent transition-all duration-300 group"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden lg:block ml-3 font-medium text-sm">Disconnect</span>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation (sm/md screens) - Glassmorphism */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 h-20 ${theme.colors.sidebar} border-t border-white/10 flex items-center justify-around z-50 px-2 pb-safe-area backdrop-blur-xl shadow-[0_-5px_20px_rgba(0,0,0,0.5)]`}>
          {menuItems.slice(0, 5).map((item) => {
              const isActive = currentView === item.id;
              return (
                  <button
                      key={item.id}
                      onClick={() => onChangeView(item.id as AppView)}
                      className="flex flex-col items-center justify-center w-full h-full"
                  >
                       <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)] -translate-y-1' : ''}`}>
                          <item.icon className={`w-5 h-5 ${isActive ? theme.colors.textAccent : 'text-slate-500'}`} />
                       </div>
                       <span className={`text-[9px] mt-1.5 font-medium tracking-wider ${isActive ? 'text-white' : 'text-slate-600'}`}>
                           {item.label === 'AI Curator' ? 'AI' : item.label}
                       </span>
                  </button>
              );
          })}
          <button onClick={onLogout} className="flex flex-col items-center justify-center w-full h-full">
               <LogOut className="w-5 h-5 text-slate-500" />
               <span className="text-[9px] mt-1.5 font-medium text-slate-600">Exit</span>
          </button>
      </div>
    </>
  );
};

export default Sidebar;

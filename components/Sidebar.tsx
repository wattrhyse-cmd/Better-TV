
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
    { id: 'DASHBOARD', icon: LayoutGrid, label: 'Dashboard', color: 'text-blue-400', activeBg: 'bg-blue-500/10' },
    { id: 'LIVE', icon: Tv, label: 'Live TV', color: 'text-rose-400', activeBg: 'bg-rose-500/10' },
    { id: 'MOVIES', icon: Film, label: 'Movies', color: 'text-cyan-400', activeBg: 'bg-cyan-500/10' },
    { id: 'SERIES', icon: MonitorPlay, label: 'Series', color: 'text-purple-400', activeBg: 'bg-purple-500/10' },
    { id: 'FAVORITES', icon: Heart, label: 'Favorites', color: 'text-pink-500', activeBg: 'bg-pink-500/10' },
    { id: 'AI_SEARCH', icon: Sparkles, label: 'AI Curator', color: 'text-emerald-400', activeBg: 'bg-emerald-500/10', highlight: true },
    { id: 'UPDATES', icon: RefreshCw, label: 'Updates', color: 'text-orange-400', activeBg: 'bg-orange-500/10' },
    { id: 'SETTINGS', icon: Settings, label: 'Settings', color: 'text-slate-400', activeBg: 'bg-slate-500/10' },
  ];

  return (
    <>
      {/* Desktop Sidebar (lg screens) */}
      <div className={`hidden md:flex w-20 lg:w-64 h-full ${theme.colors.sidebar} border-r border-slate-800 flex-col justify-between transition-colors duration-300 z-50 flex-shrink-0`}>
        <div>
          <div className="h-24 flex flex-col items-center justify-center border-b border-slate-800/50 mb-4">
              <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 bg-gradient-to-tr ${theme.colors.gradient} rounded-lg flex items-center justify-center shadow-lg`}>
                      <Tv className="text-white w-4 h-4" />
                  </div>
                  <span className="hidden lg:block font-bold text-lg tracking-wide text-white">GENIE<span className={theme.colors.textAccent}>TV</span></span>
              </div>
              <span className="hidden lg:block text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Premium Player</span>
          </div>

          <nav className="flex flex-col gap-2 px-3">
            {menuItems.map((item) => {
               const isActive = currentView === item.id;
               const iconColor = isActive ? theme.colors.textAccent : item.color;
               const activeBackground = isActive ? theme.colors.iconBg : 'hover:bg-slate-800/50';

               return (
                <button
                  key={item.id}
                  onClick={() => onChangeView(item.id as AppView)}
                  className={`
                    flex items-center p-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden
                    ${isActive ? `${activeBackground} text-white` : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}
                  `}
                >
                  {isActive && <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.colors.bgAccent} opacity-80 rounded-r-full`} />}
                  
                  <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'} ${isActive ? theme.colors.textAccent : item.color} ${item.highlight && !isActive ? 'animate-pulse' : ''}`} />
                  <span className="hidden lg:block ml-3 font-medium text-sm tracking-wide">{item.label}</span>
                  
                  <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${isActive ? 'bg-white/5' : ''}`} />
                </button>
               );
            })}
          </nav>
        </div>

        <div className="p-3 mb-4 space-y-2">
          {showInstall && (
            <button 
              onClick={onInstall}
              className={`w-full flex items-center p-3.5 rounded-xl bg-gradient-to-r ${theme.colors.gradient} text-white shadow-lg shadow-cyan-900/20 hover:shadow-cyan-900/40 hover:-translate-y-0.5 transition-all duration-300 group animate-pulse`}
            >
              <Download className="w-5 h-5" />
              <span className="hidden lg:block ml-3 font-bold text-sm">Install App</span>
            </button>
          )}

          <button 
            onClick={onLogout}
            className="w-full flex items-center p-3.5 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300 group"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden lg:block ml-3 font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation (sm/md screens) */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 h-16 ${theme.colors.sidebar} border-t border-slate-800 flex items-center justify-around z-50 px-2 pb-safe-area`}>
          {menuItems.slice(0, 5).map((item) => {
              const isActive = currentView === item.id;
              return (
                  <button
                      key={item.id}
                      onClick={() => onChangeView(item.id as AppView)}
                      className="flex flex-col items-center justify-center w-full h-full"
                  >
                       <div className={`p-1.5 rounded-xl transition-all ${isActive ? theme.colors.iconBg : ''}`}>
                          <item.icon className={`w-6 h-6 ${isActive ? theme.colors.textAccent : 'text-slate-500'}`} />
                       </div>
                       <span className={`text-[9px] mt-1 font-medium ${isActive ? 'text-white' : 'text-slate-500'}`}>
                           {item.label === 'AI Curator' ? 'AI' : item.label}
                       </span>
                  </button>
              );
          })}
          <button onClick={onLogout} className="flex flex-col items-center justify-center w-full h-full">
               <LogOut className="w-5 h-5 text-slate-500" />
               <span className="text-[9px] mt-1 font-medium text-slate-500">Exit</span>
          </button>
      </div>
    </>
  );
};

export default Sidebar;

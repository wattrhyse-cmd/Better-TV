import { StreamCategory, StreamItem, AppTheme } from './types';

// Themes
export const APP_THEMES: AppTheme[] = [
  {
    id: 'midnight',
    name: 'Midnight Blue',
    colors: {
      background: 'bg-[#0f172a]',
      sidebar: 'bg-[#0b1120]',
      cardBg: 'bg-slate-800',
      textAccent: 'text-cyan-400',
      bgAccent: 'bg-cyan-600',
      bgAccentHover: 'hover:bg-cyan-500',
      borderAccent: 'border-cyan-500',
      gradient: 'from-cyan-400 to-blue-500',
      iconBg: 'bg-cyan-500/20'
    }
  },
  {
    id: 'crimson',
    name: 'Crimson Red',
    colors: {
      background: 'bg-[#000000]',
      sidebar: 'bg-[#121212]',
      cardBg: 'bg-zinc-900',
      textAccent: 'text-red-500',
      bgAccent: 'bg-red-600',
      bgAccentHover: 'hover:bg-red-500',
      borderAccent: 'border-red-600',
      gradient: 'from-red-500 to-rose-600',
      iconBg: 'bg-red-600/20'
    }
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    colors: {
      background: 'bg-slate-900',
      sidebar: 'bg-slate-950',
      cardBg: 'bg-slate-800',
      textAccent: 'text-teal-400',
      bgAccent: 'bg-teal-600',
      bgAccentHover: 'hover:bg-teal-500',
      borderAccent: 'border-teal-500',
      gradient: 'from-teal-400 to-cyan-400',
      iconBg: 'bg-teal-500/20'
    }
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      background: 'bg-neutral-900',
      sidebar: 'bg-neutral-950',
      cardBg: 'bg-neutral-800',
      textAccent: 'text-emerald-500',
      bgAccent: 'bg-emerald-600',
      bgAccentHover: 'hover:bg-emerald-500',
      borderAccent: 'border-emerald-500',
      gradient: 'from-emerald-400 to-green-500',
      iconBg: 'bg-emerald-500/20'
    }
  },
  {
    id: 'royal',
    name: 'Royal Purple',
    colors: {
      background: 'bg-[#1a0b2e]',
      sidebar: 'bg-[#130722]',
      cardBg: 'bg-[#2d1b4e]',
      textAccent: 'text-purple-400',
      bgAccent: 'bg-purple-600',
      bgAccentHover: 'hover:bg-purple-500',
      borderAccent: 'border-purple-500',
      gradient: 'from-purple-400 to-pink-500',
      iconBg: 'bg-purple-500/20'
    }
  }
];

// Mock Categories
export const MOCK_CATEGORIES: StreamCategory[] = [
  { category_id: '8', category_name: 'UK Live Sports', parent_id: 0 },
  { category_id: '1', category_name: 'USA News', parent_id: 0 },
  { category_id: '2', category_name: 'UK Entertainment', parent_id: 0 },
  { category_id: '3', category_name: 'Sports Premium', parent_id: 0 },
  { category_id: '4', category_name: 'Documentaries', parent_id: 0 },
  { category_id: '5', category_name: 'Kids Zone', parent_id: 0 },
  { category_id: '6', category_name: 'Action Movies', parent_id: 0 },
  { category_id: '7', category_name: 'Sci-Fi Series', parent_id: 0 },
];

// Mock Streams (Mix of Live and VOD)
export const MOCK_STREAMS: StreamItem[] = [
  // UK LIVE SPORTS
  {
    num: 12,
    name: "Sky Sports Premier League",
    stream_type: "live",
    stream_id: 105,
    category_id: "8",
    stream_icon: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c2/Sky_Sports_Premier_League.svg/1200px-Sky_Sports_Premier_League.svg.png",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  },
  {
    num: 13,
    name: "TNT Sports 1",
    stream_type: "live",
    stream_id: 106,
    category_id: "8",
    stream_icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/TNT_Sports_logo.svg/1200px-TNT_Sports_logo.svg.png",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  },
  {
    num: 14,
    name: "BBC One UK",
    stream_type: "live",
    stream_id: 107,
    category_id: "8",
    stream_icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/BBC_One_2021.svg/1200px-BBC_One_2021.svg.png",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  },
  {
    num: 15,
    name: "Eurosport 1 UK",
    stream_type: "live",
    stream_id: 108,
    category_id: "8",
    stream_icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Eurosport_1_logo_2015.svg/1200px-Eurosport_1_logo_2015.svg.png",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  },

  // LIVE TV
  {
    num: 1,
    name: "Big Buck Bunny 24/7",
    stream_type: "live",
    stream_id: 101,
    category_id: "2",
    stream_icon: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_buck_bunny_poster_big.jpg",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" 
  },
  {
    num: 2,
    name: "Tech News Now",
    stream_type: "live",
    stream_id: 102,
    category_id: "1",
    stream_icon: "https://picsum.photos/200/200?random=1",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  },
  {
    num: 3,
    name: "Sports Center HD",
    stream_type: "live",
    stream_id: 103,
    category_id: "3",
    stream_icon: "https://picsum.photos/200/200?random=2",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  },
  {
    num: 4,
    name: "Nature 4K",
    stream_type: "live",
    stream_id: 104,
    category_id: "4",
    stream_icon: "https://picsum.photos/200/200?random=3",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  },
  
  // MOVIES
  {
    num: 5,
    name: "Tears of Steel",
    stream_type: "movie",
    stream_id: 201,
    category_id: "6",
    rating: "8.5",
    stream_icon: "https://mango.blender.org/wp-content/uploads/2013/05/01_thom_celia_bridge.jpg",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    progress: 45,
    subtitles: [
      { id: 'en', label: 'English', language: 'en', src: 'https://raw.githubusercontent.com/andreyvit/subtitle-tools/master/sample.vtt' },
      { id: 'es', label: 'Spanish', language: 'es', src: 'https://raw.githubusercontent.com/andreyvit/subtitle-tools/master/sample.vtt' }
    ]
  },
  {
    num: 6,
    name: "Sintel",
    stream_type: "movie",
    stream_id: 202,
    category_id: "6",
    rating: "9.0",
    stream_icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Sintel_poster.jpg/800px-Sintel_poster.jpg",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    subtitles: [
       { id: 'en', label: 'English', language: 'en', src: 'https://raw.githubusercontent.com/andreyvit/subtitle-tools/master/sample.vtt' }
    ]
  },
  {
    num: 7,
    name: "Cosmos Laundromat",
    stream_type: "movie",
    stream_id: 203,
    category_id: "6",
    rating: "7.8",
    stream_icon: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Cosmos_Laundromat_-_First_Cycle_-_Official_Theatrical_Poster.jpg",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    progress: 15
  },
  {
    num: 8,
    name: "Agent 327",
    stream_type: "movie",
    stream_id: 204,
    category_id: "6",
    rating: "8.2",
    stream_icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Agent_327_Operation_Barbershop_-_Poster.jpg/640px-Agent_327_Operation_Barbershop_-_Poster.jpg",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  },
  {
    num: 9,
    name: "Spring",
    stream_type: "movie",
    stream_id: 205,
    category_id: "6",
    rating: "8.9",
    stream_icon: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Spring_-_Blender_Open_Movie.jpg",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    progress: 88
  },

  // SERIES
  {
    num: 10,
    name: "Pioneer One",
    stream_type: "series",
    stream_id: 301,
    category_id: "7",
    rating: "8.0",
    stream_icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Pioneer_One_Poster_concept.jpg/640px-Pioneer_One_Poster_concept.jpg",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    progress: 10
  },
  {
    num: 11,
    name: "Star Trek Continues",
    stream_type: "series",
    stream_id: 302,
    category_id: "7",
    rating: "9.2",
    stream_icon: "https://upload.wikimedia.org/wikipedia/commons/0/05/Star_Trek_Continues_cast.jpg",
    direct_source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  }
];
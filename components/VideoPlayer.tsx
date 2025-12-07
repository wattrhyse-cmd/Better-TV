
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, Volume1, VolumeX, Maximize, Loader2, Minimize, Captions, AlertTriangle } from 'lucide-react';
import { SubtitleTrack } from '../types';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  onProgress?: (percentage: number) => void;
  subtitles?: SubtitleTrack[];
  onNext?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  src, 
  poster, 
  autoPlay = true, 
  onProgress,
  subtitles = [],
  onNext
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  
  const controlsTimeoutRef = useRef<number | null>(null);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
      setShowControls(true);
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
      if (isPlaying) {
          controlsTimeoutRef.current = window.setTimeout(() => setShowControls(false), 3000);
      }
  }, [isPlaying]);

  useEffect(() => {
    return () => { if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current); };
  }, []);

  // Initialize Player
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setError(null);

    // Reset previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Check if source is valid
    if (!src) {
        setError("No stream source available.");
        setIsLoading(false);
        return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });
      
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        if (autoPlay) {
            video.play().catch(e => console.log("Autoplay blocked", e));
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError("Stream playback failed. The source may be offline.");
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        if (autoPlay) video.play().catch(() => {});
      });
      video.addEventListener('error', () => {
          setError("Stream failed to load.");
          setIsLoading(false);
      });
    } else {
      setError("HLS is not supported in this browser.");
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [src, autoPlay]);

  // Event Handlers
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
      if (videoRef.current && onProgress) {
          const percent = (videoRef.current.currentTime / videoRef.current.duration) * 100;
          if (!isNaN(percent)) onProgress(percent);
      }
  };

  const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
          videoRef.current?.parentElement?.requestFullscreen();
          setIsFullscreen(true);
      } else {
          document.exitFullscreen();
          setIsFullscreen(false);
      }
  };

  return (
    <div 
        ref={(el) => { if (el && !videoRef.current?.parentElement) {} }} // Dummy ref
        className="relative group w-full h-full bg-black overflow-hidden rounded-xl shadow-2xl border border-white/10"
        onMouseMove={resetControlsTimeout}
        onClick={resetControlsTimeout}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        poster={poster}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
      />

      {/* Overlays */}
      {(isLoading && !error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-20">
            <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30 p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mb-2" />
            <p className="text-white font-bold">{error}</p>
            <p className="text-slate-400 text-sm mt-2">Check if the stream supports web playback (CORS/HTTPS).</p>
        </div>
      )}

      {/* Custom Controls */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent px-6 py-6 transition-opacity duration-300 z-10 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
         
         {/* Progress Bar (Visual Only for Live) */}
         <div className="w-full bg-white/20 h-1.5 rounded-full mb-4 overflow-hidden cursor-pointer group/progress">
            <div className="bg-cyan-500 h-full w-full origin-left scale-x-100 animate-pulse relative">
                 <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] opacity-0 group-hover/progress:opacity-100 transition-opacity"></div>
            </div>
         </div>

         <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="text-white hover:text-cyan-400 transition-colors">
                    {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
                </button>
                
                <div className="group/vol relative flex items-center">
                    <button onClick={() => setIsMuted(!isMuted)} className="text-white hover:text-cyan-400 transition-colors">
                        {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    </button>
                    <div className="w-0 overflow-hidden group-hover/vol:w-24 transition-all duration-300 ml-2">
                        <input 
                            type="range" 
                            min="0" max="1" step="0.1"
                            value={volume}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setVolume(val);
                                if (videoRef.current) videoRef.current.volume = val;
                                setIsMuted(val === 0);
                            }}
                            className="w-20 accent-cyan-500 h-1"
                        />
                    </div>
                </div>

                {/* Live Badge */}
                <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-red-500 text-xs font-bold tracking-widest uppercase">Live</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Caption Toggle (Mock) */}
                <button className="text-slate-400 hover:text-white transition-colors">
                    <Captions className="w-6 h-6" />
                </button>
                
                <button onClick={toggleFullscreen} className="text-white hover:text-cyan-400 transition-colors">
                    {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default VideoPlayer;

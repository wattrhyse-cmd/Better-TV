
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, Volume1, VolumeX, Maximize, Loader2, Minimize, Captions, Check, Gauge, SkipForward, Heart, PictureInPicture } from 'lucide-react';
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
  onNext,
  isFavorite = false,
  onToggleFavorite
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  // Subtitle State
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number>(-1); // -1 is Off

  // Playback Speed State
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const speedOptions = [0.5, 1, 1.5, 2];

  const controlsTimeoutRef = useRef<number | null>(null);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  // Check PiP Support
  useEffect(() => {
    setIsPipSupported(!!document.pictureInPictureEnabled);
  }, []);

  // Handle Fullscreen and PiP changes listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const video = videoRef.current;
    
    const handleEnterPip = () => setIsPip(true);
    const handleLeavePip = () => setIsPip(false);

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    if (video) {
        video.addEventListener('enterpictureinpicture', handleEnterPip);
        video.addEventListener('leavepictureinpicture', handleLeavePip);
    }

    return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        if (video) {
            video.removeEventListener('enterpictureinpicture', handleEnterPip);
            video.removeEventListener('leavepictureinpicture', handleLeavePip);
        }
    };
  }, []);

  // Controls Visibility Logic
  const showControlsAndScheduleHide = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
    }
    // Only auto-hide if playing
    if (isPlaying) {
        controlsTimeoutRef.current = window.setTimeout(() => {
            setShowControls(false);
            setShowSubtitleMenu(false);
            setShowSpeedMenu(false);
        }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
        showControlsAndScheduleHide();
    } else {
        setShowControls(true); // Always show controls when paused
        if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    }
    return () => {
        if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, showControlsAndScheduleHide]);


  // HLS and AutoPlay Logic
  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    // Clean up previous HLS instance if it exists
    if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
    }

    setIsLoading(true);
    setIsBuffering(false);
    setError(null);
    setActiveSubtitleIndex(-1);
    setShowSubtitleMenu(false);
    setShowSpeedMenu(false);
    setPlaybackRate(1);
    // Initialize volume
    video.volume = volume;
    video.muted = isMuted;

    const attemptPlay = () => {
        if (!autoPlay) {
            setIsLoading(false);
            return;
        }

        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    setIsPlaying(true);
                    setIsLoading(false);
                })
                .catch(error => {
                    setIsLoading(false);
                    if (error.name === 'NotAllowedError') {
                        // Autoplay with sound failed. Mute and try again.
                        console.log("Autoplay blocked. Muting and retrying.");
                        video.muted = true;
                        setIsMuted(true);
                        setVolume(0); 
                        video.play()
                            .then(() => setIsPlaying(true))
                            .catch(e => {
                                console.warn("Autoplay still blocked after muting:", e);
                                setIsPlaying(false);
                            });
                    } else if (error.name === 'AbortError') {
                        // Playback aborted (likely user navigation). Ignore.
                    } else {
                         console.warn("Playback error:", error);
                         // Don't set visible error state for plays that fail immediately if it's just user interaction required
                         if (error.name !== 'NotAllowedError') {
                           setIsPlaying(false);
                         }
                    }
                });
        } else {
            setIsLoading(false);
        }
    };

    let lastProgressUpdate = 0;
    const handleTimeUpdate = () => {
        const now = Date.now();
        // Throttle updates to once every 5 seconds to prevent React re-render thrashing
        if (onProgressRef.current && video.duration && (now - lastProgressUpdate > 5000)) {
            const percentage = (video.currentTime / video.duration) * 100;
            if (!isNaN(percentage)) {
                onProgressRef.current(Math.floor(percentage));
                lastProgressUpdate = now;
            }
        }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
        setIsBuffering(false);
        setIsLoading(false);
    };

    const handleNativeError = (e: Event) => {
        // Ignore aborted errors (code 20) which happen during source change
        if (video.error && video.error.code === MediaError.MEDIA_ERR_ABORTED) {
            return;
        }
        console.error("Native Video Error", video.error);
        setError("Playback failed.");
        setIsLoading(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleNativeError);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        attemptPlay();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        // Filter out errors that shouldn't show a UI error
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.response && data.response.code === 404) {
             setError("Stream not found.");
             setIsLoading(false);
             return;
        }

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover network error
              console.log("fatal network error encountered, try to recover");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("fatal media error encountered, try to recover");
              hls.recoverMediaError();
              break;
            default:
              console.error("Fatal HLS error", data);
              setError("Stream error.");
              setIsLoading(false);
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari/Mobile)
      video.src = src;
      video.addEventListener('loadedmetadata', attemptPlay);
    } else {
      setError("HLS is not supported.");
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
          video.removeEventListener('timeupdate', handleTimeUpdate);
          video.removeEventListener('error', handleNativeError);
          video.removeEventListener('loadedmetadata', attemptPlay);
          video.removeEventListener('waiting', handleWaiting);
          video.removeEventListener('playing', handlePlaying);
          
          // Stop loading to prevent "The fetching process..." error
          video.pause();
          video.removeAttribute('src');
          video.load();
      }
    };
  }, [src, autoPlay]); // Removed onProgress from dependency array

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => setIsPlaying(true))
                .catch(err => {
                    console.error("Play error", err);
                    // Handle blocked unmuted play by trying muted
                    if(err.name === 'NotAllowedError' && !isMuted) {
                         videoRef.current!.muted = true;
                         setIsMuted(true);
                         setVolume(0);
                         videoRef.current!.play().then(() => setIsPlaying(true));
                    }
                });
        }
      }
      showControlsAndScheduleHide();
    }
  };

  const handleContainerClick = () => {
      if (showControls) {
          if (isPlaying) {
              setShowControls(false);
              setShowSubtitleMenu(false);
              setShowSpeedMenu(false);
          } else {
              showControlsAndScheduleHide();
          }
      } else {
          showControlsAndScheduleHide();
      }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      
      // If unmuting and volume is 0, bump it to 50%
      if (!newMuted && volume === 0) {
        const newVol = 0.5;
        setVolume(newVol);
        videoRef.current.volume = newVol;
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVol = parseFloat(e.target.value);
      setVolume(newVol);
      if (videoRef.current) {
          videoRef.current.volume = newVol;
          if (newVol > 0 && isMuted) {
              videoRef.current.muted = false;
              setIsMuted(false);
          } else if (newVol === 0) {
              videoRef.current.muted = true;
              setIsMuted(true);
          }
      }
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  const togglePip = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error("Failed to toggle PiP mode", err);
    }
  };

  const selectSubtitle = (index: number) => {
      const video = videoRef.current;
      if (!video) return;

      const tracks = video.textTracks;
      if (tracks && tracks.length > 0) {
          for (let i = 0; i < tracks.length; i++) {
              tracks[i].mode = 'hidden';
          }
          if (index !== -1 && tracks[index]) {
              tracks[index].mode = 'showing';
          }
      }
      setActiveSubtitleIndex(index);
      setShowSubtitleMenu(false);
  };

  const handleSpeedChange = (speed: number) => {
      const video = videoRef.current;
      if (video) {
          video.playbackRate = speed;
          setPlaybackRate(speed);
          setShowSpeedMenu(false);
      }
  };

  const getVolumeIcon = () => {
      if (isMuted || volume === 0) return <VolumeX size={24} />;
      if (volume < 0.5) return <Volume1 size={24} />;
      return <Volume2 size={24} />;
  };

  return (
    <div 
        ref={containerRef}
        className="relative group w-full h-full bg-black overflow-hidden rounded-lg shadow-2xl flex items-center justify-center select-none"
        onMouseLeave={() => { if(isPlaying) setShowControls(false); }}
        onMouseMove={showControlsAndScheduleHide}
        onClick={handleContainerClick}
    >
      {/* Enhanced Loading / Buffering Indicator */}
      {(isLoading || isBuffering) && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/60 backdrop-blur-[2px] pointer-events-none transition-opacity duration-300">
          <div className="relative">
             <Loader2 className="w-14 h-14 text-cyan-500 animate-spin" />
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-black/40 rounded-full blur-md"></div>
             </div>
          </div>
          <div className="mt-4 flex items-center space-x-2">
             <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
             <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
             <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="mt-2 text-cyan-400 font-bold text-xs tracking-[0.2em] uppercase opacity-90 animate-pulse">
            {isLoading ? 'Connecting' : 'Buffering'}
          </p>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/80 text-white p-4 text-center pointer-events-none">
          <div>
            <p className="text-red-500 font-bold mb-2">Playback Error</p>
            <p className="text-sm text-gray-300">{error}</p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        poster={poster}
        className="w-full h-full object-contain"
        crossOrigin="anonymous" 
        playsInline 
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      >
        {subtitles.map((sub, index) => (
            <track 
                key={sub.id}
                kind="subtitles"
                label={sub.label}
                srcLang={sub.language}
                src={sub.src}
                default={index === activeSubtitleIndex}
            />
        ))}
      </video>

      {/* Center Play Button for Touch Devices when paused or controls shown */}
      {!isPlaying && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-black/40 rounded-full p-4 backdrop-blur-sm hover:bg-black/60 transition-colors">
                <Play size={48} className="text-white fill-current" />
            </div>
        </div>
      )}

      {/* Skeleton Controls Overlay (Loading State) */}
      {isLoading && (
         <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent z-30">
            <div className="flex items-center justify-between animate-pulse">
                <div className="flex items-center space-x-6">
                   <div className="w-10 h-10 bg-slate-700/50 rounded-full"></div> {/* Play/Pause */}
                   <div className="w-8 h-8 bg-slate-700/50 rounded-full hidden sm:block"></div> {/* Volume */}
                </div>
                <div className="flex items-center space-x-4">
                   <div className="w-8 h-8 bg-slate-700/50 rounded-lg"></div> {/* CC */}
                   <div className="w-8 h-8 bg-slate-700/50 rounded-lg"></div> {/* Fullscreen */}
                </div>
            </div>
         </div>
      )}

      {/* Controls Overlay (Active State) */}
      {!isLoading && (
        <div 
            onClick={(e) => e.stopPropagation()} 
            className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 z-30 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
                <button onClick={togglePlay} className="text-white hover:text-cyan-400 transition-colors p-2 -ml-2 rounded-full hover:bg-white/10">
                    {isPlaying ? <Pause size={28} className="fill-current" /> : <Play size={28} className="fill-current" />}
                </button>
                
                {onNext && (
                   <button onClick={onNext} className="text-white hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-white/10" title="Next Channel">
                      <SkipForward size={24} className="fill-current" />
                   </button>
                )}

                {/* Enhanced Volume Control */}
                <div className="flex items-center group/volume relative hidden sm:flex">
                    <button 
                        onClick={toggleMute} 
                        className="text-white hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-white/10 z-10"
                    >
                        {getVolumeIcon()}
                    </button>
                    <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300 ease-out flex items-center -ml-2 pl-2">
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="w-20 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300"
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
                
                {/* Favorite Toggle */}
                {onToggleFavorite && (
                  <button 
                    onClick={onToggleFavorite}
                    className={`transition-colors p-2 rounded-lg hover:bg-white/10 ${isFavorite ? 'text-pink-500' : 'text-white hover:text-pink-500'}`}
                    title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                  >
                    <Heart size={24} className={isFavorite ? "fill-current" : ""} />
                  </button>
                )}

                {/* Speed Control */}
                <div className="relative">
                    <button 
                         onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowSubtitleMenu(false); }}
                         className={`transition-colors p-2 rounded-lg hover:bg-white/10 ${playbackRate !== 1 ? 'text-cyan-400' : 'text-white hover:text-cyan-400'}`}
                         title="Playback Speed"
                    >
                        <div className="flex items-center gap-1">
                             <Gauge size={24} />
                             <span className="text-xs font-bold w-6 hidden sm:block">{playbackRate}x</span>
                        </div>
                    </button>
                    {showSpeedMenu && (
                        <div className="absolute bottom-14 right-0 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-2 w-32 z-50 animate-fadeIn mb-2 overflow-hidden">
                             <div className="text-[10px] font-bold text-slate-500 uppercase px-3 py-2 mb-1 border-b border-slate-800">Speed</div>
                             {speedOptions.map((speed) => (
                                 <button
                                     key={speed}
                                     onClick={() => handleSpeedChange(speed)}
                                     className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-white/10 active:bg-slate-800 text-white flex justify-between items-center transition-colors"
                                 >
                                     <span className={playbackRate === speed ? 'font-bold' : ''}>{speed}x</span>
                                     {playbackRate === speed && <Check size={14} className="text-cyan-400" />}
                                 </button>
                             ))}
                        </div>
                    )}
                </div>

                {subtitles && subtitles.length > 0 && (
                    <div className="relative">
                        <button 
                            onClick={() => { setShowSubtitleMenu(!showSubtitleMenu); setShowSpeedMenu(false); }}
                            className={`transition-colors p-2 rounded-lg hover:bg-white/10 ${activeSubtitleIndex !== -1 ? 'text-cyan-400' : 'text-white hover:text-cyan-400'}`}
                            title="Subtitles / Captions"
                        >
                            <Captions size={24} />
                        </button>
                        
                        {showSubtitleMenu && (
                            <div className="absolute bottom-14 right-0 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-2 w-48 z-50 animate-fadeIn mb-2 overflow-hidden">
                                <div className="text-[10px] font-bold text-slate-500 uppercase px-3 py-2 mb-1 border-b border-slate-800">Subtitles</div>
                                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                    <button 
                                        onClick={() => selectSubtitle(-1)}
                                        className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-white/10 active:bg-slate-800 text-white flex justify-between items-center transition-colors"
                                    >
                                        <span className={activeSubtitleIndex === -1 ? 'font-bold' : ''}>Off</span>
                                        {activeSubtitleIndex === -1 && <Check size={14} className="text-cyan-400" />}
                                    </button>
                                    {subtitles.map((sub, index) => (
                                        <button
                                            key={sub.id}
                                            onClick={() => selectSubtitle(index)}
                                            className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-white/10 active:bg-slate-800 text-white flex justify-between items-center transition-colors"
                                        >
                                            <span className={activeSubtitleIndex === index ? 'font-bold' : ''}>{sub.label}</span>
                                            {activeSubtitleIndex === index && <Check size={14} className="text-cyan-400" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {/* PiP Toggle */}
                {isPipSupported && (
                    <button 
                        onClick={togglePip}
                        className={`transition-colors p-2 rounded-lg hover:bg-white/10 ${isPip ? 'text-cyan-400' : 'text-white hover:text-cyan-400'}`}
                        title={isPip ? "Exit Picture-in-Picture" : "Picture-in-Picture"}
                    >
                        <PictureInPicture size={24} />
                    </button>
                )}

                <button onClick={toggleFullscreen} className="text-white hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-white/10">
                    {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                </button>
            </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;

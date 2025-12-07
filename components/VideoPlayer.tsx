
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

    if (!
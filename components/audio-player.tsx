"use client";

import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

export interface AudioPlayerHandle {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
}

interface AudioPlayerProps {
  src: string;
  onTimeUpdate?: (time: number) => void;
}

const SPEED_OPTIONS = [0.5, 0.7, 1.0, 1.2, 1.5, 1.7, 2.0, 2.5, 3.0, 4.0];

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer(
  { src, onTimeUpdate },
  ref,
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  useImperativeHandle(ref, () => ({
    seekTo(time: number) {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        audioRef.current.play();
        setIsPlaying(true);
      }
    },
    getCurrentTime() {
      return audioRef.current?.currentTime ?? 0;
    },
  }));

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  }, [onTimeUpdate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // Close speed menu on outside click
  useEffect(() => {
    if (!showSpeedMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setShowSpeedMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSpeedMenu]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  };

  const stepSpeed = (direction: number) => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    const next = idx + direction;
    if (next >= 0 && next < SPEED_OPTIONS.length) {
      changeSpeed(SPEED_OPTIONS[next]);
    }
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
  };

  const formatTime = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const formatRate = (rate: number) => {
    return rate % 1 === 0 ? `${rate}.0x` : `${rate}x`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div>
      <audio ref={audioRef} src={src} preload="metadata" onTimeUpdate={handleTimeUpdate} />

      {/* Seek bar */}
      <div
        className="group relative h-1 w-full cursor-pointer bg-zinc-200 transition-all hover:h-1.5 dark:bg-zinc-800"
        onClick={handleSeek}
      >
        <div
          className="absolute left-0 top-0 h-full bg-amber-500"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          style={{ left: `${progress}%` }}
        />
      </div>

      {/* Controls — centered */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 md:gap-4">
        {/* Speed control */}
        <div className="flex h-8 items-center md:h-9">
          <button
            onClick={() => stepSpeed(-1)}
            disabled={SPEED_OPTIONS.indexOf(playbackRate) <= 0}
            className="flex h-8 w-5 items-center justify-center text-xs text-zinc-300 transition-colors hover:text-zinc-600 disabled:opacity-0 md:h-9 md:w-6 md:text-sm dark:text-zinc-600 dark:hover:text-zinc-300"
          >
            &lt;
          </button>
          <div ref={speedMenuRef} className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className={`flex h-8 items-center rounded-md px-1 font-mono text-xs tabular-nums transition-colors md:h-9 md:text-sm ${
                playbackRate !== 1.0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              {formatRate(playbackRate)}
            </button>

            {showSpeedMenu && (
              <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {SPEED_OPTIONS.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changeSpeed(rate)}
                    className={`block w-full whitespace-nowrap px-4 py-1 text-left font-mono text-xs tabular-nums transition-colors md:text-sm ${
                      rate === playbackRate
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    {formatRate(rate)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => stepSpeed(1)}
            disabled={SPEED_OPTIONS.indexOf(playbackRate) >= SPEED_OPTIONS.length - 1}
            className="flex h-8 w-5 items-center justify-center text-xs text-zinc-300 transition-colors hover:text-zinc-600 disabled:opacity-0 md:h-9 md:w-6 md:text-sm dark:text-zinc-600 dark:hover:text-zinc-300"
          >
            &gt;
          </button>
        </div>

        {/* Play/pause */}
        <button
          onClick={togglePlay}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white transition-all hover:bg-amber-400 active:scale-95 md:h-9 md:w-9"
        >
          {isPlaying ? (
            <svg className="h-3 w-3 md:h-3.5 md:w-3.5" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="1" width="4" height="12" rx="1" />
              <rect x="8" y="1" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg className="h-3 w-3 md:h-3.5 md:w-3.5" viewBox="0 0 14 14" fill="currentColor">
              <path d="M4 1.5v11l8-5.5z" />
            </svg>
          )}
        </button>

        <span className="flex h-8 items-center font-mono text-xs tabular-nums text-zinc-400 ml-2 md:ml-3 md:h-9 md:text-sm">
          {formatTime(currentTime)}
          <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
});

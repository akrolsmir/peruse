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

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  function AudioPlayer({ src, onTimeUpdate }, ref) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

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

    const skip = (seconds: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(
          0,
          Math.min(audioRef.current.currentTime + seconds, duration)
        );
      }
    };

    const formatTime = (s: number) => {
      if (!isFinite(s)) return "0:00";
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = Math.floor(s % 60);
      if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
      return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div>
        <audio ref={audioRef} src={src} preload="metadata" onTimeUpdate={handleTimeUpdate} />

        {/* Seek bar — full width at top edge of player bar */}
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

        {/* Controls */}
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => skip(-15)}
              className="rounded-md px-2 py-1 font-mono text-xs tabular-nums text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              −15
            </button>
            <button
              onClick={togglePlay}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white transition-all hover:bg-amber-400 active:scale-95"
            >
              {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="2" y="1" width="4" height="12" rx="1" />
                  <rect x="8" y="1" width="4" height="12" rx="1" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M4 1.5v11l8-5.5z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => skip(15)}
              className="rounded-md px-2 py-1 font-mono text-xs tabular-nums text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              +15
            </button>
          </div>

          <span className="font-mono text-xs tabular-nums text-zinc-400">
            {formatTime(currentTime)}
            <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
            {formatTime(duration)}
          </span>
        </div>
      </div>
    );
  }
);

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
      const pct = (e.clientX - rect.left) / rect.width;
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
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = Math.floor(s % 60);
      if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
      return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <audio ref={audioRef} src={src} preload="metadata" onTimeUpdate={handleTimeUpdate} />

        <div className="flex items-center gap-3">
          <button
            onClick={() => skip(-15)}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            title="Back 15s"
          >
            -15s
          </button>
          <button
            onClick={togglePlay}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="2" y="1" width="4" height="12" rx="1" />
                <rect x="8" y="1" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M3 1.5v11l9-5.5z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => skip(15)}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            title="Forward 15s"
          >
            +15s
          </button>

          <div className="flex flex-1 items-center gap-2">
            <span className="text-xs tabular-nums text-zinc-500">{formatTime(currentTime)}</span>
            <div
              className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-zinc-200 dark:bg-zinc-700"
              onClick={handleSeek}
            >
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-zinc-500">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    );
  }
);

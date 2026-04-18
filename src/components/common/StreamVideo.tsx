import { useEffect, useRef, type VideoHTMLAttributes } from 'react';
import { AUTH_STAGE_MEDIA_MIME_TYPE, prewarmAuthStageMedia } from '@/constants/media';

interface StreamVideoProps extends VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
}

export function StreamVideo({ src, ...props }: StreamVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    prewarmAuthStageMedia();

    const video = videoRef.current;
    if (!video) return;

    let handleLoadedData: (() => void) | null = null;

    const attemptPlayback = () => {
      void video.play().catch(() => undefined);
    };

    video.defaultMuted = true;
    video.muted = true;

    if (!video.canPlayType(AUTH_STAGE_MEDIA_MIME_TYPE)) {
      video.removeAttribute('src');
      video.load();
      return;
    }

    video.src = src;
    handleLoadedData = () => {
      attemptPlayback();
    };
    video.addEventListener('loadeddata', handleLoadedData);
    attemptPlayback();

    return () => {
      if (handleLoadedData) {
        video.removeEventListener('loadeddata', handleLoadedData);
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      {...props}
    />
  );
}

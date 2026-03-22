import { useQrStore } from '../store/qrStore';
import './PosterScreen.css';

export default function PosterScreen() {
  const locationData = useQrStore(s => s.locationData);
  const setIdle = useQrStore(s => s.setIdle);

  if (!locationData || !locationData.posterUrl) return null;

  const url = locationData.posterUrl;
  const lower = url.toLowerCase();
  const isVideo = lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogg');
  const isIframe = lower.includes('youtube.com') || lower.includes('vimeo.com') || lower.includes('iframe');

  return (
    <div className="poster-screen" onClick={() => setIdle(false)}>
      {isVideo ? (
        <video src={url} autoPlay loop muted playsInline className="poster-media" />
      ) : isIframe ? (
        <iframe src={url + (url.includes('?') ? '&' : '?') + 'autoplay=1&mute=1&loop=1&controls=0'} className="poster-media" frameBorder="0" allow="autoplay; fullscreen" />
      ) : (
        <img src={url} alt="Promo" className="poster-media" />
      )}
      <div className="poster-overlay">
        <h1 className="poster-touch-text">Atinge ecranul pentru a comanda</h1>
      </div>
    </div>
  );
}

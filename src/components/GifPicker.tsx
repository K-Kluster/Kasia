import { FC, useState, useEffect, useRef } from "react";
import clsx from "clsx";

interface GifPickerProps {
  onGifSelect: (gifUrl: string) => void;
  onClose: () => void;
}

interface TenorGif {
  id: string;
  title: string;
  media_formats: {
    gif?: {
      url: string;
      dims: [number, number];
    };
    tinygif?: {
      url: string;
      dims: [number, number];
    };
    webm?: {
      url: string;
      dims: [number, number];
    };
  };
}

interface TenorResponse {
  results: TenorGif[];
  next?: string;
}

export const GifPicker: FC<GifPickerProps> = ({ onGifSelect, onClose }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tenor API key - using anonymous key for public use
  const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ";

  useEffect(() => {
    // Focus search input when component mounts
    searchInputRef.current?.focus();

    // Load trending GIFs initially
    loadTrendingGifs();
  }, []);

  const loadTrendingGifs = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20&media_filter=gif`
      );

      if (!response.ok) {
        throw new Error("Failed to load trending GIFs");
      }

      const data: TenorResponse = await response.json();
      console.log("Tenor API response:", data); // Debug log

      // Filter out GIFs that don't have the required media formats
      const validGifs = data.results.filter(
        (gif) =>
          gif.media_formats &&
          (gif.media_formats.gif || gif.media_formats.webm) &&
          (gif.media_formats.tinygif || gif.media_formats.gif)
      );

      setGifs(validGifs);
    } catch (err) {
      setError("Failed to load GIFs. Please try again.");
      console.error("Error loading trending GIFs:", err);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      loadTrendingGifs();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(
          query
        )}&limit=20&media_filter=gif`
      );

      if (!response.ok) {
        throw new Error("Failed to search GIFs");
      }

      const data: TenorResponse = await response.json();
      console.log("Tenor search response:", data); // Debug log

      // Filter out GIFs that don't have the required media formats
      const validGifs = data.results.filter(
        (gif) =>
          gif.media_formats &&
          (gif.media_formats.gif || gif.media_formats.webm) &&
          (gif.media_formats.tinygif || gif.media_formats.gif)
      );

      setGifs(validGifs);
    } catch (err) {
      setError("Failed to search GIFs. Please try again.");
      console.error("Error searching GIFs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Debounce search
    const timeoutId = setTimeout(() => {
      searchGifs(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleGifClick = (gif: TenorGif) => {
    // Use the best available URL format
    const gifUrl = gif.media_formats.gif?.url || gif.media_formats.webm?.url;
    if (gifUrl) {
      onGifSelect(gifUrl);
      onClose();
    }
  };

  const getPreviewUrl = (gif: TenorGif) => {
    // Use tinygif for preview, fallback to gif
    return gif.media_formats.tinygif?.url || gif.media_formats.gif?.url || "";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[var(--secondary-bg)] rounded-lg p-4 max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Choose a GIF
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Search Input */}
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search for GIFs..."
          className="w-full px-3 py-2 bg-[var(--primary-bg)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />

        {/* GIF Grid */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-[var(--text-secondary)]">
                Loading GIFs...
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-8">
              <div className="text-red-500">{error}</div>
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-2 gap-2">
              {gifs.map((gif) => {
                const previewUrl = getPreviewUrl(gif);
                if (!previewUrl) return null;

                return (
                  <button
                    key={gif.id}
                    onClick={() => handleGifClick(gif)}
                    className="relative aspect-square rounded-md overflow-hidden hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <img
                      src={previewUrl}
                      alt={gif.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        console.error("Failed to load GIF preview:", gif.id);
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {!loading && !error && gifs.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="text-[var(--text-secondary)]">
                No GIFs found. Try a different search term.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 text-xs text-[var(--text-secondary)] text-center">
          Powered by Tenor
        </div>
      </div>
    </div>
  );
};

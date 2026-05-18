'use client';

import { useEffect, useState } from 'react';

const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
];

export default function PhotoSelector({
  eventId,
  photos = [],
  onSelectionChange,
}) {
  const [platform, setPlatform] = useState('linkedin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Default-include every photo as it shows up. AI-ASSISTED, not AI-controlled:
  // the user starts with everything selected and the suggester narrows it.
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const p of photos) next.add(p.id);
      return next;
    });
  }, [photos]);

  // Push selection changes up to the parent so PostDrafter sees only chosen photos.
  useEffect(() => {
    onSelectionChange?.(Array.from(selectedIds));
  }, [selectedIds, onSelectionChange]);

  function toggle(photoId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(photos.map((p) => p.id)));
  }

  function clearAll() {
    setSelectedIds(new Set());
  }

  async function handleSuggest() {
    setLoading(true);
    setError(null);
    setSuggestions(null);
    try {
      const res = await fetch('/api/suggest-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Suggestion failed');
      setSuggestions(data);
      // Apply AI picks as the new selection — user can still tweak.
      setSelectedIds(new Set(data.selected.map((s) => s.photo_id)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const reasonById = new Map(
    (suggestions?.selected || []).map((s) => [s.photo_id, s])
  );

  // AI-picked photos float to the top (in AI's order), the rest follow.
  const sorted = [...photos].sort((a, b) => {
    const ra = reasonById.get(a.id);
    const rb = reasonById.get(b.id);
    if (ra && rb) return ra.position - rb.position;
    if (ra) return -1;
    if (rb) return 1;
    return 0;
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">
          Suggest photos for:
        </span>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={loading || photos.length === 0}
          className="rounded-lg bg-purple-700 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Thinking…' : 'Get AI suggestions'}
        </button>

        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          <span>
            {selectedIds.size} of {photos.length} selected
          </span>
          <button
            type="button"
            onClick={selectAll}
            disabled={photos.length === 0}
            className="text-purple-700 hover:underline disabled:opacity-50"
          >
            All
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={clearAll}
            disabled={selectedIds.size === 0}
            className="text-purple-700 hover:underline disabled:opacity-50"
          >
            None
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {suggestions && (
        <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-purple-700">
            AI narrative — {suggestions.platform}
          </p>
          <p className="mt-1 text-sm text-gray-800">{suggestions.narrative}</p>
          <p className="mt-2 text-xs text-gray-600">
            AI picked {suggestions.selected.length} photo
            {suggestions.selected.length === 1 ? '' : 's'}. You can override below — drafting uses whatever stays checked.
          </p>
        </div>
      )}

      {photos.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          Upload photos to start selecting.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((photo) => {
            const isSelected = selectedIds.has(photo.id);
            const sug = reasonById.get(photo.id);
            return (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => toggle(photo.id)}
                  className={`relative block w-full overflow-hidden rounded-xl border-2 text-left transition ${
                    isSelected
                      ? 'border-purple-500 ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="aspect-square bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.cloudinary_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {sug && (
                    <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-purple-700 px-2 py-0.5 text-xs font-medium text-white shadow">
                      #{sug.position} · {Number(sug.score).toFixed(1)}
                    </span>
                  )}

                  <span
                    className={`absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 shadow ${
                      isSelected
                        ? 'border-purple-700 bg-purple-700 text-white'
                        : 'border-gray-300 bg-white text-transparent'
                    }`}
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 010 1.4l-7.3 7.3a1 1 0 01-1.4 0L4.3 10.3a1 1 0 011.4-1.4L9 12.2l6.3-6.3a1 1 0 011.4 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>

                  {sug && (
                    <div className="border-t border-purple-100 bg-purple-50 p-2 text-xs text-gray-700">
                      <span className="font-medium text-purple-700">Why: </span>
                      {sug.reason}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

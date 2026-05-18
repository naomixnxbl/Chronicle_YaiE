'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn', primary: true },
  { id: 'instagram', label: 'Instagram', primary: false },
  { id: 'facebook', label: 'Facebook', primary: false },
];

export default function PostDrafter({
  eventId,
  eventName,
  eventType,
  photos = [],
  onPostGenerated,
}) {
  const [platform, setPlatform] = useState('linkedin');
  const [prompt, setPrompt] = useState('');
  const [previousPosts, setPreviousPosts] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('posts')
        .select('id, platform, angle, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (!cancelled) setPreviousPosts(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function handleGenerate() {
    setGenerating(true);
    setDraft('');
    setError(null);
    setCopied(false);
    try {
      const res = await fetch('/api/draft-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          eventId,
          eventName,
          eventType,
          userNotes: prompt,
          photos: photos.map((p) => ({
            labels: p.vision_labels || [],
            notes: p.user_notes || '',
          })),
          previousPosts: previousPosts.map((p) => ({
            platform: p.platform,
            angle: p.angle,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate post');
      setDraft(data.post);
      if (data.id) {
        setPreviousPosts((prev) => [
          {
            id: data.id,
            platform,
            angle: null,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        onPostGenerated?.({ id: data.id, platform, content: data.post });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => {
          const active = platform === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlatform(p.id)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'border-purple-700 bg-purple-50 text-purple-800'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p.label}
              {p.primary && <span className="ml-1">⭐</span>}
            </button>
          );
        })}
      </div>

      {previousPosts.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Previously posted
          </p>
          <div className="flex flex-wrap gap-1.5">
            {previousPosts.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700"
              >
                {p.platform}
                {p.angle ? ` · ${p.angle}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Or type what you want..."
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-lg bg-purple-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {generating && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-600">
            {"Drafting in WSTI's voice..."}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!generating && draft && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-gray-900">
            Does this sound like WSTI?
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Regenerate
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              Approve and copy
            </button>
            {copied && (
              <span className="text-sm font-medium text-green-700">
                Copied — ready to paste
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PhotoUploader from '@/components/PhotoUploader';
import PhotoSelector from '@/components/PhotoSelector';
import PostDrafter from '@/components/PostDrafter';

const EVENT_TYPE_STYLES = {
  'AI Shed': 'bg-purple-100 text-purple-800',
  Hackathon: 'bg-blue-100 text-blue-800',
  'AI Innovation Summit': 'bg-indigo-100 text-indigo-800',
  Bootcamp: 'bg-green-100 text-green-800',
  'Young AI Engineers Club': 'bg-teal-100 text-teal-800',
  'VIP Visit': 'bg-amber-100 text-amber-800',
  'Build with AI x Google': 'bg-red-100 text-red-800',
  'Community Event': 'bg-pink-100 text-pink-800',
  Other: 'bg-gray-100 text-gray-800',
};

function eventTypeClasses(type) {
  return EVENT_TYPE_STYLES[type] || EVENT_TYPE_STYLES.Other;
}

function formatAuDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function EventDetailPage({ params }) {
  const { id } = use(params);

  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // null = no curation yet, treat as "all photos" for the drafter.
  const [selectedPhotoIds, setSelectedPhotoIds] = useState(null);

  const photosForDrafter =
    selectedPhotoIds === null
      ? photos
      : photos.filter((p) => selectedPhotoIds.includes(p.id));

  const fetchPhotos = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('photos')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: true });
    if (err) throw err;
    setPhotos(data || []);
  }, [id]);

  const fetchPosts = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('posts')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false });
    if (err) throw err;
    setPosts(data || []);
  }, [id]);

  const fetchEvent = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
    if (err) throw err;
    setEvent(data);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchEvent(), fetchPhotos(), fetchPosts()]);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load event');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, fetchEvent, fetchPhotos, fetchPosts]);

  async function handleNotesSaved(photoId, notes) {
    const { error: err } = await supabase
      .from('photos')
      .update({ user_notes: notes })
      .eq('id', photoId);
    if (!err) {
      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, user_notes: notes } : p))
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
            Loading event…
          </div>
        </div>
      </main>
    );
  }

  if (error || !event) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Link
            href="/home"
            className="text-sm font-medium text-purple-700 hover:underline"
          >
            ← Back to home
          </Link>
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error || 'Event not found.'}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 transition hover:text-purple-700"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 010 1.06L8.06 11l4.73 4.71a.75.75 0 11-1.06 1.06l-5.25-5.25a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z"
              clipRule="evenodd"
            />
          </svg>
          Back
        </Link>

        <header className="mt-4">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            {event.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${eventTypeClasses(
                event.event_type
              )}`}
            >
              {event.event_type}
            </span>
            <span className="text-sm text-gray-500">
              {formatAuDate(event.date)}
            </span>
            {event.location && (
              <span className="text-sm text-gray-500">· {event.location}</span>
            )}
            {event.attendee_count != null && (
              <span className="text-sm text-gray-500">
                · {event.attendee_count} attendees
              </span>
            )}
          </div>
          {(event.notes || event.key_people) && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm">
              {event.notes && (
                <p className="whitespace-pre-wrap">{event.notes}</p>
              )}
              {event.key_people && (
                <p
                  className={`whitespace-pre-wrap ${
                    event.notes ? 'mt-3 border-t border-gray-100 pt-3' : ''
                  }`}
                >
                  <span className="font-medium text-gray-900">
                    Key people:
                  </span>{' '}
                  {event.key_people}
                </p>
              )}
            </div>
          )}
        </header>

        {photos.length > 0 && (
          <section className="mt-8">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Select photos
              </h2>
              <p className="text-xs text-gray-500">
                AI suggests, you decide. Drafting uses whatever is checked.
              </p>
            </div>
            <PhotoSelector
              eventId={event.id}
              photos={photos}
              onSelectionChange={setSelectedPhotoIds}
            />
          </section>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Photos
            </h2>
            <PhotoUploader
              eventId={event.id}
              photos={photos}
              onUploaded={fetchPhotos}
              onNotesSaved={handleNotesSaved}
            />
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Draft post
            </h2>
            <PostDrafter
              eventId={event.id}
              eventName={event.name}
              eventType={event.event_type}
              photos={photosForDrafter}
              onPostGenerated={fetchPosts}
            />

            {posts.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Post log
                </h3>
                <ul className="space-y-3">
                  {posts.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize">
                          {p.platform}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatAuDate(p.created_at)}
                        </span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">
                        {p.content}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

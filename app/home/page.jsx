'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AddEventModal from '@/components/AddEventModal';

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

export default function HomePage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');

  async function fetchEvents() {
    setLoading(true);
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  function handlePromptSubmit(e) {
    e.preventDefault();
    // TODO: wire up to post-drafting flow
    console.log('Prompt submitted:', prompt);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-purple-800">
            Chronicle
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            by Western Sydney Tech Innovators
          </p>
        </header>

        <form onSubmit={handlePromptSubmit} className="mb-8 flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={'Try: "Recap of last Thursday\'s AI Shed for LinkedIn"'}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-purple-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Go
          </button>
        </form>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Events</h2>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            + Add event
          </button>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
            Loading events…
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm font-medium text-gray-900">No events yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Add your first WSTI event to start drafting posts.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-6 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-800"
            >
              + Add event
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => {
              const isPosted = (event.post_count ?? 0) > 0;
              return (
                <li key={event.id}>
                  <button
                    onClick={() => router.push(`/event/${event.id}`)}
                    className="w-full text-left rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-purple-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {event.name}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${eventTypeClasses(
                              event.event_type
                            )}`}
                          >
                            {event.event_type}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          {formatAuDate(event.date)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                          {event.photo_count ?? 0}{' '}
                          {event.photo_count === 1 ? 'photo' : 'photos'}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            isPosted
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isPosted ? 'Posted' : 'Not posted'}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showModal && (
        <AddEventModal
          onClose={() => setShowModal(false)}
          onCreated={(newEvent) => {
            setShowModal(false);
            fetchEvents();
            if (newEvent?.id) router.push(`/event/${newEvent.id}`);
          }}
        />
      )}
    </main>
  );
}

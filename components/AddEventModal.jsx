'use client';

import { useState } from 'react';

const EVENT_TYPES = [
  'AI Shed',
  'Hackathon',
  'AI Innovation Summit',
  'Bootcamp',
  'Young AI Engineers Club',
  'VIP Visit',
  'Build with AI x Google',
  'Community Event',
  'Other',
];

// Event-type-specific placeholders so the prompts feel tailored.
const NOTES_PLACEHOLDERS = {
  'AI Shed':
    'e.g. 40 people turned up, lots of first-timers, Team 3 demoed a tool for local cafés',
  Hackathon:
    'e.g. 12 teams, 48 hours, winning project was a healthcare AI tool',
  'AI Innovation Summit':
    'e.g. Grand Finale night, 109 attendees, Investment NSW spoke',
  Bootcamp:
    'e.g. 4-week program wrap, 18 graduates, focus on practical AI tools',
  'Young AI Engineers Club':
    'e.g. Launch night, students paired with local SMEs',
  'VIP Visit':
    'e.g. Andrew Charlton MP visited, met with founders, spoke about the community',
  'Build with AI x Google':
    'e.g. One-day hackathon with Google, idea → prototype in 8 hours',
  'Community Event':
    'e.g. Pizza night, fireside chat, casual catch-up after AI Shed',
  Other: 'What happened? Who showed up? Any standout moments?',
};

const KEY_PEOPLE_PLACEHOLDERS = {
  'AI Shed': 'e.g. Lailei opening, mentors who circulated, any newcomers',
  Hackathon: 'e.g. judges, winning team, sponsor reps',
  'AI Innovation Summit':
    'e.g. Investment NSW reps, judges, headline speakers',
  Bootcamp: 'e.g. lead instructor, standout participants',
  'Young AI Engineers Club':
    'e.g. student leads, partner SME owners, council reps',
  'VIP Visit':
    'e.g. Andrew Charlton MP, council leaders, who they met',
  'Build with AI x Google': 'e.g. Google team, mentors, winning team',
  'Community Event': 'e.g. who hosted, special guests, long-time members',
  Other: 'Anyone worth naming — VIPs, speakers, partners',
};

export default function AddEventModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('Western Sydney Startup Hub, Parramatta');
  const [attendeeCount, setAttendeeCount] = useState('');
  const [notes, setNotes] = useState('');
  const [keyPeople, setKeyPeople] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          date,
          event_type: eventType,
          location: location.trim() || null,
          attendee_count: attendeeCount ? parseInt(attendeeCount, 10) : null,
          notes: notes.trim() || null,
          key_people: keyPeople.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event');
      }
      onCreated?.(data);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const notesPlaceholder =
    NOTES_PLACEHOLDERS[eventType] || NOTES_PLACEHOLDERS.Other;
  const peoplePlaceholder =
    KEY_PEOPLE_PLACEHOLDERS[eventType] || KEY_PEOPLE_PLACEHOLDERS.Other;

  const inputCls =
    'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">Add event</h2>
          <p className="mt-1 text-sm text-gray-500">
            The more context you add, the better Chronicle drafts posts later.
            Only name, type, and date are required.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="event-name"
                className="block text-sm font-medium text-gray-700"
              >
                Event name <span className="text-red-500">*</span>
              </label>
              <input
                id="event-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AI Shed — 16 May"
                className={inputCls}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="event-type"
                  className="block text-sm font-medium text-gray-700"
                >
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="event-type"
                  required
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className={inputCls}
                >
                  <option value="" disabled>
                    Select type…
                  </option>
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="event-date"
                  className="block text-sm font-medium text-gray-700"
                >
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="event-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div>
                <label
                  htmlFor="event-location"
                  className="block text-sm font-medium text-gray-700"
                >
                  Location
                </label>
                <input
                  id="event-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Where did it happen?"
                  className={inputCls}
                />
              </div>

              <div>
                <label
                  htmlFor="event-attendees"
                  className="block text-sm font-medium text-gray-700"
                >
                  Approx attendees
                </label>
                <input
                  id="event-attendees"
                  type="number"
                  min="0"
                  value={attendeeCount}
                  onChange={(e) => setAttendeeCount(e.target.value)}
                  placeholder="40"
                  className={`${inputCls} sm:w-28`}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="event-notes"
                className="block text-sm font-medium text-gray-700"
              >
                What happened?
                <span className="ml-1 text-xs font-normal text-gray-500">
                  highlights, key moments, vibe
                </span>
              </label>
              <textarea
                id="event-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={notesPlaceholder}
                className={inputCls}
              />
            </div>

            <div>
              <label
                htmlFor="event-people"
                className="block text-sm font-medium text-gray-700"
              >
                Key people, partners, or VIPs
              </label>
              <textarea
                id="event-people"
                rows={2}
                value={keyPeople}
                onChange={(e) => setKeyPeople(e.target.value)}
                placeholder={peoplePlaceholder}
                className={inputCls}
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { WSTI_SYSTEM_PROMPT } from '@/lib/prompt';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Service-role client — bypasses RLS. NEVER expose this to the browser.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PLATFORM_RULES = {
  linkedin:
    'Hook must land in the first 210 characters (this is what shows before "...more"). Total length: 150–220 words. Structure: Hook → what happened → who was there → what it meant → CTA. Hashtags inline at the end of the post — 3 to 5 only, no hashtags mid-post. Professional but warm and story-driven.',
  instagram:
    'Hook must land in the first 125 characters (this is what shows before "more"). Total length: 60–90 words plus hashtags. Hashtags on new lines after the caption (not inline). Always include a carousel order recommendation at the end — explicitly state which photo goes 1st, 2nd, 3rd and why. Punchy, visual, community energy. 2–4 emojis used naturally.',
  facebook:
    'Total length: 100–140 words. Warm community announcement tone. Great for tagging partners (City of Parramatta Council, UNSW, Google, Investment NSW). Write like you are talking to a neighbour. Briefly explain WSTI events for people who have never heard of them. Maximum 5 hashtags.',
};

function buildUserMessage({
  platform,
  event,
  photos,
  userNotes,
  previousPosts,
}) {
  const photoLines = (photos || [])
    .map((p, i) => {
      const labels =
        Array.isArray(p.labels) && p.labels.length > 0
          ? p.labels.join(', ')
          : 'none';
      const notes = p.notes?.trim() ? p.notes.trim() : 'none';
      return `Photo ${i + 1}:\n  Labels: ${labels}\n  Notes: ${notes}`;
    })
    .join('\n');

  const previousLines =
    previousPosts && previousPosts.length > 0
      ? previousPosts
          .map((p) => `- ${p.platform}: ${p.angle || 'unspecified angle'}`)
          .join('\n')
      : 'Nothing yet — this is the first post for this event.';

  const extraEventBits = [];
  if (event.date) extraEventBits.push(`Date: ${event.date}`);
  if (event.location) extraEventBits.push(`Location: ${event.location}`);
  if (event.attendee_count)
    extraEventBits.push(`Approx attendees: ${event.attendee_count}`);
  if (event.notes?.trim())
    extraEventBits.push(`What happened: ${event.notes.trim()}`);
  if (event.key_people?.trim())
    extraEventBits.push(`Key people / partners: ${event.key_people.trim()}`);

  const eventBlock = `EVENT
Name: ${event.name}
Type: ${event.type}${
    extraEventBits.length > 0 ? '\n' + extraEventBits.join('\n') : ''
  }`;

  return `Draft a ${platform} post for the following WSTI event.

${eventBlock}

PHOTOS (${(photos || []).length} total)
${photoLines || 'No photos provided.'}

ADDITIONAL CONTEXT FROM THE USER
${userNotes?.trim() || 'None provided.'}

ALREADY POSTED FOR THIS EVENT — DO NOT REPEAT THESE ANGLES
${previousLines}

PLATFORM RULES — ${platform.toUpperCase()}
${PLATFORM_RULES[platform]}

Use the event context (location, attendee count, what happened, key people) as ground truth — these come from the human organising the event. Photo labels are AI-detected hints; user-provided photo notes outrank labels.

Now write the post. Output only the post text itself — no preamble, no explanations, no quote marks around it.`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      platform,
      eventId,
      eventName,
      eventType,
      photos = [],
      userNotes = '',
      previousPosts = [],
    } = body;

    const normalisedPlatform = (platform || '').toLowerCase();
    if (!PLATFORM_RULES[normalisedPlatform]) {
      return NextResponse.json(
        { error: 'platform must be one of: linkedin, instagram, facebook' },
        { status: 400 }
      );
    }
    if (!eventName || !eventType) {
      return NextResponse.json(
        { error: 'eventName and eventType are required' },
        { status: 400 }
      );
    }

    // Enrich event data from the database if we have an eventId — picks up
    // location, attendee_count, notes, key_people that the caller might not
    // bother sending in the body.
    let eventDetails = {
      name: eventName,
      type: eventType,
      date: null,
      location: null,
      attendee_count: null,
      notes: null,
      key_people: null,
    };
    if (eventId) {
      const { data: ev } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (ev) {
        eventDetails = {
          name: ev.name || eventName,
          type: ev.event_type || eventType,
          date: ev.date,
          location: ev.location,
          attendee_count: ev.attendee_count,
          notes: ev.notes,
          key_people: ev.key_people,
        };
      }
    }

    const userMessage = buildUserMessage({
      platform: normalisedPlatform,
      event: eventDetails,
      photos,
      userNotes,
      previousPosts,
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: WSTI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const postText =
      message.content
        ?.filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim() || '';

    if (!postText) {
      return NextResponse.json(
        { error: 'Claude returned an empty response' },
        { status: 500 }
      );
    }

    // Save the draft to Supabase. event_id is optional here — if the caller
    // didn't pass one we still return the draft; it just isn't linked.
    let savedId = null;
    if (eventId) {
      const { data: saved, error: saveError } = await supabase
        .from('posts')
        .insert({
          event_id: eventId,
          platform: normalisedPlatform,
          content: postText,
        })
        .select('id')
        .single();

      if (saveError) {
        return NextResponse.json(
          { error: `Saved draft failed: ${saveError.message}` },
          { status: 500 }
        );
      }
      savedId = saved.id;
    }

    return NextResponse.json({
      post: postText,
      platform: normalisedPlatform,
      id: savedId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Draft generation failed' },
      { status: 500 }
    );
  }
}

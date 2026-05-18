import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Service-role client — bypasses RLS. NEVER expose this to the browser.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PLATFORM_TARGETS = {
  linkedin: {
    count: 2,
    vibe: 'Professional, story-driven. Pick 1–2 hero shots that show people, scale, or authority. Lead with the strongest emotional moment. Avoid generic tech-only shots.',
  },
  instagram: {
    count: 8,
    vibe: 'Carousel of 6–10. Strong hero first, variety through the middle (people + action + detail), group/closing shot last. Visual variety matters more than perfection.',
  },
  facebook: {
    count: 5,
    vibe: 'Community feel. 3–5 photos. Family-friendly faces, partner shots welcome, warmth over polish.',
  },
};

export async function POST(request) {
  try {
    const { eventId, platform } = await request.json();

    if (!eventId || !platform) {
      return NextResponse.json(
        { error: 'eventId and platform are required' },
        { status: 400 }
      );
    }

    const normalisedPlatform = (platform || '').toLowerCase();
    const target = PLATFORM_TARGETS[normalisedPlatform];
    if (!target) {
      return NextResponse.json(
        { error: 'platform must be linkedin, instagram, or facebook' },
        { status: 400 }
      );
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name, event_type, date')
      .eq('id', eventId)
      .single();
    if (eventError) {
      return NextResponse.json(
        { error: `Event lookup failed: ${eventError.message}` },
        { status: 500 }
      );
    }

    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('id, vision_labels, vision_faces, user_notes')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    if (photosError) {
      return NextResponse.json({ error: photosError.message }, { status: 500 });
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: 'No photos uploaded for this event yet' },
        { status: 400 }
      );
    }

    const photoLines = photos
      .map((p, i) => {
        const labels =
          (p.vision_labels || []).slice(0, 6).join(', ') || 'no labels';
        const faces = p.vision_faces?.count ?? 0;
        const notes = p.user_notes?.trim() || 'none';
        return `${i + 1}. [id:${p.id}] Labels: ${labels}. Faces: ${faces}. User notes: ${notes}`;
      })
      .join('\n');

    const userMessage = `You are helping curate photos for a ${normalisedPlatform} post about a WSTI event.

EVENT
Name: ${event.name}
Type: ${event.event_type}

PHOTOS AVAILABLE (${photos.length} total)
${photoLines}

PLATFORM TARGET — ${normalisedPlatform.toUpperCase()}
${target.vibe}
Target count: roughly ${target.count} photos.

WEIGHTING
- Photos with user notes signal that a human cares about them — favour these.
- Photos with multiple faces tend to land harder than tech-only shots.
- Avoid near-duplicates.

TASK
Pick the best ~${target.count} photos for this post. For each pick:
- Cite the photo id EXACTLY as shown in [id:...].
- One short sentence explaining WHY (cite labels, faces, or notes — be concrete).
- Score 1.0–10.0 (10 = must include).
Also describe the narrative arc in one short sentence.

OUTPUT — STRICT JSON, NOTHING ELSE. No code fences, no prose:
{
  "selected": [
    { "photo_id": "<id from input>", "position": 1, "reason": "<one sentence>", "score": 9.2 }
  ],
  "narrative": "<short arc>"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText =
      message.content
        ?.filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim() || '';

    // Strip code fences if Claude wrapped the JSON despite instructions.
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json(
        { error: 'Claude returned non-JSON output', raw: rawText },
        { status: 500 }
      );
    }

    // Defensive: only return suggestions for photo IDs that actually exist.
    const validIds = new Set(photos.map((p) => p.id));
    const selected = (parsed.selected || []).filter((s) =>
      validIds.has(s.photo_id)
    );

    return NextResponse.json({
      platform: normalisedPlatform,
      target_count: target.count,
      selected,
      narrative: parsed.narrative || '',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Suggestion failed' },
      { status: 500 }
    );
  }
}

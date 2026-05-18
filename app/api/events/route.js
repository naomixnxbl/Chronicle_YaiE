import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS. NEVER expose this to the browser.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*, photos(count), posts(count)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten the PostgREST count shape: photos: [{count: 3}] -> photo_count: 3
    const events = data.map((event) => ({
      ...event,
      photo_count: event.photos?.[0]?.count ?? 0,
      post_count: event.posts?.[0]?.count ?? 0,
      photos: undefined,
      posts: undefined,
    }));

    return NextResponse.json(events);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name,
      date,
      event_type,
      location = null,
      attendee_count = null,
      notes = null,
      key_people = null,
    } = body;

    if (!name || !date || !event_type) {
      return NextResponse.json(
        { error: 'name, date, and event_type are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        name,
        date,
        event_type,
        location,
        attendee_count,
        notes,
        key_people,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

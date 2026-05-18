import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Service-role client — bypasses RLS. NEVER expose this to the browser.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const eventId = formData.get('event_id');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { error: 'file is required' },
        { status: 400 }
      );
    }
    if (!eventId) {
      return NextResponse.json(
        { error: 'event_id is required' },
        { status: 400 }
      );
    }

    // Convert the uploaded File to a base64 data URI so Cloudinary's
    // upload() can ingest it without needing a writable filesystem.
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${buffer.toString('base64')}`;

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      upload_preset: 'chronicle_uploads',
    });

    const { data: photo, error: insertError } = await supabase
      .from('photos')
      .insert({
        event_id: eventId,
        cloudinary_url: uploadResult.secure_url,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(photo, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { createClient } from '@supabase/supabase-js';

// ImageAnnotatorClient picks up credentials automatically from the
// GOOGLE_APPLICATION_CREDENTIALS env var (path to a service-account JSON).
const vision = new ImageAnnotatorClient();

// Service-role client — bypasses RLS. NEVER expose this to the browser.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request) {
  try {
    const { photo_id, image_url } = await request.json();

    if (!photo_id || !image_url) {
      return NextResponse.json(
        { error: 'photo_id and image_url are required' },
        { status: 400 }
      );
    }

    const [result] = await vision.annotateImage({
      image: { source: { imageUri: image_url } },
      features: [
        { type: 'LABEL_DETECTION', maxResults: 20 },
        { type: 'FACE_DETECTION', maxResults: 20 },
      ],
    });

    if (result.error?.message) {
      return NextResponse.json(
        { error: `Vision API: ${result.error.message}` },
        { status: 500 }
      );
    }

    const labels = (result.labelAnnotations || [])
      .filter((l) => (l.score ?? 0) > 0.7)
      .map((l) => l.description);

    const faceAnnotations = result.faceAnnotations || [];
    const faces = {
      count: faceAnnotations.length,
      confidence_scores: faceAnnotations.map((f) => f.detectionConfidence),
    };

    const { data: photo, error: updateError } = await supabase
      .from('photos')
      .update({ vision_labels: labels, vision_faces: faces })
      .eq('id', photo_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(photo);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Vision processing failed' },
      { status: 500 }
    );
  }
}

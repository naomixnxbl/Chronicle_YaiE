'use client';

import { useRef, useState } from 'react';

const STATUS_LABEL = {
  uploading: 'Uploading…',
  labelling: 'Labelling…',
  done: 'Done',
  error: 'Failed',
};

export default function PhotoUploader({
  eventId,
  photos = [],
  onUploaded,
  onNotesSaved,
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [jobs, setJobs] = useState([]);

  function updateJob(id, status) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) =>
      f.type.startsWith('image/')
    );
    if (files.length === 0) return;

    const newJobs = files.map((f) => ({
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      name: f.name,
      status: 'uploading',
    }));
    setJobs((prev) => [...prev, ...newJobs]);

    await Promise.all(
      files.map(async (file, idx) => {
        const jobId = newJobs[idx].id;
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('event_id', eventId);

          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          if (!uploadRes.ok) throw new Error('Upload failed');
          const photo = await uploadRes.json();

          updateJob(jobId, 'labelling');

          await fetch('/api/vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              photo_id: photo.id,
              image_url: photo.cloudinary_url,
            }),
          });

          updateJob(jobId, 'done');
        } catch {
          updateJob(jobId, 'error');
        }
      })
    );

    onUploaded?.();

    // Clear successful jobs after a moment; keep errors visible for retry context.
    setTimeout(() => {
      setJobs((prev) => prev.filter((j) => j.status === 'error'));
    }, 1500);
  }

  function handleNotesBlur(photoId, currentValue, originalValue) {
    if ((currentValue || '') === (originalValue || '')) return;
    onNotesSaved?.(photoId, currentValue);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
          isDragging
            ? 'border-purple-500 bg-purple-50'
            : 'border-gray-300 bg-white'
        }`}
      >
        <p className="text-sm font-medium text-gray-900">
          Drop photos here
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Or choose multiple images from your device
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 inline-flex items-center rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        >
          Choose photos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {jobs.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs"
            >
              <span className="truncate text-gray-700">{job.name}</span>
              <span
                className={`ml-3 shrink-0 font-medium ${
                  job.status === 'error'
                    ? 'text-red-600'
                    : job.status === 'done'
                    ? 'text-green-600'
                    : 'text-purple-700'
                }`}
              >
                {STATUS_LABEL[job.status]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {photos.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
            >
              <div className="aspect-square bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.cloudinary_url}
                  alt={
                    (photo.vision_labels && photo.vision_labels[0]) ||
                    'Event photo'
                  }
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="p-3">
                {photo.vision_labels && photo.vision_labels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {photo.vision_labels.slice(0, 5).map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  defaultValue={photo.user_notes || ''}
                  placeholder="Add context…"
                  onBlur={(e) =>
                    handleNotesBlur(
                      photo.id,
                      e.target.value,
                      photo.user_notes || ''
                    )
                  }
                  className="mt-2 w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

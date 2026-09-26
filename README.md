# ResQ — Emergency Call Accessibility

A trusted voice line between the public and first responders during emergencies. People in disaster zones (hurricanes, earthquakes, outages) leave a tiny, low-bandwidth voice message; the app transcribes it, extracts what's needed, and drops a pin on a live map — giving responders a searchable dashboard instead of raw voice memos.

## Pipeline

Low-bandwidth voice → transcription → structured extraction (who/where/what) → map pin → clustering → authenticity score → responder dashboard

## Two apps

- **Public app:** one-tap SOS recording (no forms, no submit step), auto-detected disaster type, live recording feedback, and a Life360-style Family Circle for "I'm safe" status.
- **Responder dashboard:** live map, categorized requests, analytics, authenticity scoring to flag hoaxes.

## Stack

Next.js, Tailwind CSS, MediaRecorder/Opus, IndexedDB, device GPS, Google Maps API (live map + pins), Grok API (transcription/classification). Satellite connectivity via SpaceX is the target integration for offline/no-signal scenarios.

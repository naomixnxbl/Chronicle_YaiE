export type ContentTheme =
  | "preservation"
  | "meanings"
  | "sustainability"
  | "behind-the-scenes";

export type Audience = "awareness" | "consideration" | "mixed";

export type Platform = "instagram" | "youtube" | "advertisement";

export type VideoEngine = "heygen" | "higgsfield";

export interface ProjectState {
  topic: string;
  theme: ContentTheme;
  audience: Audience;
  platforms: Platform[];
  talkingPoints: string;
  audioName: string | null;
  audioUrl: string | null; // object URL for preview only (per-session)
  audioBlob: Blob | null; // the raw audio, kept in memory for transcription
  transcript: string; // raw transcript from the audio (invisible source-of-truth)
  script: string;
  aspect: AspectRatio; // output format / platform
  contentType: ContentType;
  videoUrl: string | null;
}

export type ContentType = "educational" | "awareness";

export const CONTENT_TYPES: { id: ContentType; label: string; blurb: string; ico: string }[] = [
  { id: "educational", label: "Educational", blurb: "Teach the topic warmly, with a presenter & b-roll.", ico: "📚" },
  { id: "awareness", label: "Awareness", blurb: "A moving, shareable, cause-led message.", ico: "🌍" },
];

export type AspectRatio = "9:16" | "1:1" | "16:9";

export const ASPECTS: { id: AspectRatio; label: string; platform: string; ico: string }[] = [
  { id: "9:16", label: "Vertical", platform: "Reels · TikTok · Shorts", ico: "📱" },
  { id: "1:1", label: "Square", platform: "Instagram · Facebook feed", ico: "⬜" },
  { id: "16:9", label: "Widescreen", platform: "YouTube · website", ico: "🖥️" },
];

export interface ApiKeys {
  anthropic: string; // script enhancement (Claude)
  openai: string; // audio transcription (Whisper)
  heygen: string; // optional presenter-style video
  higgsfield: string; // creative cinematic video (primary)
}

export const emptyProject: ProjectState = {
  topic: "",
  theme: "preservation",
  audience: "mixed",
  platforms: ["instagram"],
  talkingPoints: "",
  audioName: null,
  audioUrl: null,
  audioBlob: null,
  transcript: "",
  script: "",
  aspect: "9:16",
  contentType: "educational",
  videoUrl: null,
};

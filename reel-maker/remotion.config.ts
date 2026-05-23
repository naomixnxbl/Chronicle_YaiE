import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// H.264 with broad-compatibility pixel format so the MP4 plays everywhere
// (Instagram, LinkedIn, QuickTime, etc.)
Config.setPixelFormat("yuv420p");

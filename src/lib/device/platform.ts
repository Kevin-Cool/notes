import {
    platform,
    type Platform,
} from "@tauri-apps/plugin-os";

export const currentPlatform: Platform = platform();

export const isMobilePlatform: boolean =
    currentPlatform === "android" ||
    currentPlatform === "ios";

export const isDesktopPlatform: boolean =
    !isMobilePlatform;
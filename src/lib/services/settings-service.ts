import { invoke } from "@tauri-apps/api/core";
import { enable, isEnabled } from "@tauri-apps/plugin-autostart";

export type ThemeName = "pink" | "yellow" | "berry" | "cloud" | "rose-dark";

export interface AppSettingRecord {
    key: string;
    value: string;
    updated_at: string;
}

// Keys
const AUTOSTART_PROMPT_DISMISSED_KEY: string = "autostart_prompt_dismissed";
const APP_THEME_KEY: string = "app_theme";

// Autostart popup
export async function hasDismissedAutostartPrompt(): Promise<boolean> {
    const setting: AppSettingRecord | null =
        await invoke<AppSettingRecord | null>("get_app_setting", {
            key: AUTOSTART_PROMPT_DISMISSED_KEY,
        });

    return setting?.value === "true";
}

export async function dismissAutostartPrompt(): Promise<void> {
    await invoke<void>("set_app_setting", {
        key: AUTOSTART_PROMPT_DISMISSED_KEY,
        value: "true",
    });
}

export async function isAutostartRegistered(): Promise<boolean> {
    return await isEnabled();
}

export async function enableAutostart(): Promise<void> {
    await enable();
}

// Theme
export async function getSavedTheme(): Promise<ThemeName | null> {
    const setting: AppSettingRecord | null =
        await invoke<AppSettingRecord | null>("get_app_setting", {
            key: APP_THEME_KEY,
        });

    if (isThemeName(setting?.value)) {
        return setting.value;
    }

    return null;
}

export async function saveTheme(theme: ThemeName): Promise<void> {
    await invoke<void>("set_app_setting", {
        key: APP_THEME_KEY,
        value: theme,
    });
}

function isThemeName(value: string | undefined): value is ThemeName {
    return value === "pink"
        || value === "yellow"
        || value === "berry"
        || value === "cloud"
        || value === "rose-dark";
}
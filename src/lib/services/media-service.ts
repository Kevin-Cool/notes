import type { MediaRecord } from "$lib/types/media-record";
import { invoke } from "@tauri-apps/api/core";

type ImportMediaBytesPayload = {
    file_name: string;
    mime_type: string | null;
    bytes: number[];
};

export async function importMedia(sourcePath: string): Promise<MediaRecord> {
    const media: MediaRecord = await invoke("import_media", {
        sourcePath,
    });

    return media;
}

export async function importMediaBytes(file: File): Promise<MediaRecord> {
    const arrayBuffer: ArrayBuffer = await file.arrayBuffer();
    const bytes: number[] = Array.from(new Uint8Array(arrayBuffer));

    const payload: ImportMediaBytesPayload = {
        file_name: file.name || "pasted-image.png",
        mime_type: file.type || null,
        bytes,
    };

    const media: MediaRecord = await invoke("import_media_bytes", {
        payload,
    });

    return media;
}

export async function getMediaById(mediaId: string): Promise<MediaRecord | null> {
    const media: MediaRecord | null = await invoke("get_media_by_id", {
        mediaId,
    });

    return media;
}

export async function getMediaFilePath(mediaId: string): Promise<string | null> {
    const filePath: string | null = await invoke("get_media_file_path", {
        mediaId,
    });

    return filePath;
}
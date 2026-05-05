import { invoke } from "@tauri-apps/api/core";
import type { NoteRecord } from "$lib/types/note";

export async function saveNotePreview(
    noteId: string,
    imageDataUrl: string,
): Promise<string> {
    const relativePath: string = await invoke("save_note_preview", {
        noteId,
        imageDataUrl,
    });

    return relativePath;
}

export async function getNoteById(noteId: string): Promise<NoteRecord | null> {
    const note: NoteRecord | null = await invoke("get_note_by_id", {
        noteId,
    });

    return note;
}

export async function getLatestNote(): Promise<NoteRecord | null> {
	return await invoke("get_latest_note");
}

export async function getAllNotes(): Promise<NoteRecord[]> {
    const notes: NoteRecord[] = await invoke("get_all_notes");

    return notes;
}

export async function getNotePreviewFilePath(
    noteId: string,
): Promise<string | null> {
    const filePath: string | null = await invoke("get_note_preview_file_path", {
        noteId,
    });

    return filePath;
}

export async function upsertNote(note: NoteRecord): Promise<void> {
    await invoke("upsert_note", { note });
}

export async function deleteNote(noteId: string): Promise<void> {
    await invoke("delete_note", {
        noteId,
    });
}
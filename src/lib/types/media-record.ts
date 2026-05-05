export type MediaRecord = {
    id: string;
    file_name: string;
    original_name: string;
    mime_type: string | null;
    size_bytes: number;
    relative_path: string;
    created_at: string;
};
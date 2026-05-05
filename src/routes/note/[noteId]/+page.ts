import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params }) => {
    const noteId: string = params.noteId;

    return {
        noteId,
    };
};
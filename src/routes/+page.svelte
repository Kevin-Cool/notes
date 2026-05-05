<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { getLatestNote } from "$lib/services/note-service";
	import type { NoteRecord } from "$lib/types/note";

	onMount(async (): Promise<void> => {
		try {
			const note: NoteRecord | null = await getLatestNote();

			if (!note) {
				void goto("/note/new");
				return;
			}

			void goto(`/note/${note.id}`);
		} catch (error: unknown) {
			console.error("failed to redirect:", error);
			void goto("/notes");
		}
	});
</script>

<p>Opening last note...</p>
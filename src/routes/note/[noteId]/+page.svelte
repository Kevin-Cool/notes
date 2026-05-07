<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import type { PageData } from "./$types";
	import NoteEditor from "$lib/components/NoteEditor.svelte";
	import type { NoteRecord } from "$lib/types/note";
	import { getNoteById, upsertNote } from "$lib/services/note-service";
	import { extractNoteNameFromHtml } from "$lib/utils/note-name";
	import { beforeNavigate } from "$app/navigation";

	import hljs from "highlight.js";
	import "highlight.js/styles/atom-one-dark-reasonable.css";

	import { toPng } from "html-to-image";
	import { saveNotePreview } from "$lib/services/note-service";

	let { data }: { data: PageData } = $props();
	let isSavingInProgress: boolean = $state(false);
	let noteName: string = $state("");

	const editorKey = $derived(`note-${data.noteId}`);

	type SaveStatus = "idle" | "saving" | "saved" | "error";

	let initialContent: string | null = $state(null);
	let currentContent: string = $state("");
	let lastSavedContent: string = $state("");
	let hasLoaded: boolean = $state(false);
	let isNew: boolean = $state(true);

	let saveStatus: SaveStatus = $state("idle");
	let saveMessage: string = $state("");
	let showSaveFeedback: boolean = $state(false);

	let createdAt: string = $state("");
	let lastUpdatedAt: string = $state("");

	let autosaveInterval: ReturnType<typeof setInterval> | null = null;
	let hideSaveFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;
	let saveRequestCounter: number = 0;

	let lastPreviewContent: string = $state("");
	let previewCooldownTimeout: ReturnType<typeof setTimeout> | null = null;
	let isPreviewSavingInProgress: boolean = $state(false);
	let previewHostElement: HTMLDivElement | null = $state(null);

	let loadedNoteId: string | null = $state(null);
	let isSwitchingNote: boolean = $state(false);

	function buildNoteRecord(noteId: string, content: string): NoteRecord {
		const nowIsoString: string = new Date().toISOString();

		const nextNoteName: string = isNew
			? extractNoteNameFromHtml(content, 20)
			: noteName;

		return {
			id: noteId,
			name: nextNoteName,
			content,
			thumbnail: null,
			created_at: createdAt || nowIsoString,
			last_updated_at: nowIsoString,
		};
	}

	function clearHideSaveFeedbackTimeout(): void {
		if (hideSaveFeedbackTimeout) {
			clearTimeout(hideSaveFeedbackTimeout);
			hideSaveFeedbackTimeout = null;
		}
	}

	function showTemporarySavedState(): void {
		clearHideSaveFeedbackTimeout();

		showSaveFeedback = true;
		saveStatus = "saved";
		saveMessage = "Saved";

		hideSaveFeedbackTimeout = setTimeout((): void => {
			if (saveStatus === "saved") {
				showSaveFeedback = false;
				saveStatus = "idle";
				saveMessage = "";
			}
		}, 1200);
	}

	function showErrorState(message: string): void {
		clearHideSaveFeedbackTimeout();

		showSaveFeedback = true;
		saveStatus = "error";
		saveMessage = message;
	}

	function clearPreviewCooldownTimeout(): void {
		if (previewCooldownTimeout) {
			clearTimeout(previewCooldownTimeout);
			previewCooldownTimeout = null;
		}
	}

	function buildPreviewHtml(content: string): string {
		return `
		<div class="tiptap-editor note-preview-content">
			${content}
		</div>
	`;
	}

	async function generateNotePreviewImageDataUrl(
		content: string,
	): Promise<string> {
		const hostElement: HTMLDivElement | null = previewHostElement;

		if (!hostElement) {
			throw new Error("preview host element is not ready");
		}

		const previewContainer: HTMLDivElement = document.createElement("div");
		previewContainer.className = "note-preview-render";
		previewContainer.innerHTML = buildPreviewHtml(content);

		const codeElements: NodeListOf<HTMLElement> =
			previewContainer.querySelectorAll("pre code");

		codeElements.forEach((codeElement: HTMLElement): void => {
			hljs.highlightElement(codeElement);
		});

		hostElement.innerHTML = "";
		hostElement.appendChild(previewContainer);

		try {
			const dataUrl: string = await toPng(previewContainer, {
				cacheBust: true,
				pixelRatio: 1,
			});

			return dataUrl;
		} finally {
			if (previewHostElement === hostElement) {
				hostElement.innerHTML = "";
			}
		}
	}

	async function saveCurrentNoteFromShortcut(): Promise<void> {
		if (!loadedNoteId) {
			showUpToDateState();
			return;
		}

		const contentSnapshot: string = currentContent;
		const hasContentChanged: boolean = contentSnapshot !== lastSavedContent;
		const hasPreviewChanged: boolean =
			contentSnapshot !== lastPreviewContent;

		if (!hasContentChanged && !hasPreviewChanged) {
			showUpToDateState();
			return;
		}

		clearPreviewCooldownTimeout();

		await saveIfChanged(loadedNoteId, contentSnapshot, true);
		await savePreviewIfChanged(loadedNoteId, contentSnapshot);

		showTemporarySavedState();
	}

	async function flushCurrentNote(noteId: string): Promise<void> {
		const contentSnapshot: string = currentContent;

		clearPreviewCooldownTimeout();

		await saveIfChanged(noteId, contentSnapshot, true);
		await savePreviewIfChanged(noteId, contentSnapshot);
	}

	async function switchToNote(nextNoteId: string): Promise<void> {
		if (isSwitchingNote) {
			return;
		}

		if (loadedNoteId === nextNoteId) {
			return;
		}

		isSwitchingNote = true;

		try {
			if (loadedNoteId !== null) {
				await flushCurrentNote(loadedNoteId);
			}

			hasLoaded = false;
			await loadNote(nextNoteId);
		} finally {
			isSwitchingNote = false;
		}
	}

	async function savePreviewIfChanged(
		noteId: string,
		contentSnapshot: string,
	): Promise<void> {
		if (!hasLoaded) {
			return;
		}

		if (isPreviewSavingInProgress) {
			return;
		}

		if (contentSnapshot.trim().length === 0) {
			return;
		}

		if (contentSnapshot === lastPreviewContent) {
			return;
		}

		isPreviewSavingInProgress = true;

		try {
			const imageDataUrl: string =
				await generateNotePreviewImageDataUrl(contentSnapshot);

			await saveNotePreview(noteId, imageDataUrl);

			lastPreviewContent = contentSnapshot;
		} catch (error: unknown) {
			console.error("failed to save note preview:", error);
		} finally {
			isPreviewSavingInProgress = false;
		}
	}

	function schedulePreviewSave(): void {
		clearPreviewCooldownTimeout();

		const delayInMilliseconds: number =
			lastPreviewContent.trim().length === 0 ? 3000 : 20000;

		previewCooldownTimeout = setTimeout((): void => {
			if (loadedNoteId) {
				void savePreviewIfChanged(loadedNoteId, currentContent);
			}
		}, delayInMilliseconds);
	}

	async function loadNote(noteId: string): Promise<void> {
		const existingNote: NoteRecord | null = await getNoteById(noteId);

		if (existingNote) {
			initialContent = existingNote.content;
			currentContent = existingNote.content;
			lastSavedContent = existingNote.content;
			lastPreviewContent = existingNote.content;
			noteName = existingNote.name;
			createdAt = existingNote.created_at;
			lastUpdatedAt = existingNote.last_updated_at;
			isNew = false;
		} else {
			const nowIsoString: string = new Date().toISOString();

			initialContent = "";
			currentContent = "";
			lastSavedContent = "";
			lastPreviewContent = "";
			noteName = "";
			createdAt = nowIsoString;
			lastUpdatedAt = nowIsoString;
			isNew = true;
		}

		loadedNoteId = noteId;
		hasLoaded = true;
	}

	async function saveIfChanged(
		noteId: string,
		contentSnapshot: string,
		force: boolean = false,
	): Promise<void> {
		if (!hasLoaded) {
			return;
		}

		if (isSavingInProgress && !force) {
			return;
		}

		if (contentSnapshot.trim().length === 0) {
			return;
		}

		if (contentSnapshot === lastSavedContent) {
			return;
		}

		const requestId: number = ++saveRequestCounter;

		clearHideSaveFeedbackTimeout();
		showSaveFeedback = true;
		saveStatus = "saving";
		saveMessage = isNew ? "Creating note..." : "Saving...";
		isSavingInProgress = true;

		try {
			const note: NoteRecord = buildNoteRecord(noteId, contentSnapshot);

			await upsertNote(note);

			if (requestId !== saveRequestCounter) {
				return;
			}

			noteName = note.name;
			lastSavedContent = contentSnapshot;
			lastUpdatedAt = new Date().toISOString();
			isNew = false;
			showTemporarySavedState();
		} catch (error: unknown) {
			if (requestId !== saveRequestCounter) {
				return;
			}

			console.error("failed to save note:", error);
			showErrorState("Save failed");
		} finally {
			isSavingInProgress = false;
		}
	}

	function showUpToDateState(): void {
		clearHideSaveFeedbackTimeout();

		showSaveFeedback = true;
		saveStatus = "saved";
		saveMessage = "Up to date";

		hideSaveFeedbackTimeout = setTimeout((): void => {
			if (saveStatus === "saved") {
				showSaveFeedback = false;
				saveStatus = "idle";
				saveMessage = "";
			}
		}, 1200);
	}

	function handleContentChange(content: string): void {
		currentContent = content;
		schedulePreviewSave();
	}

	async function handleRenameNote(nextName: string): Promise<void> {
		if (!loadedNoteId) {
			return;
		}

		const trimmedName: string = nextName.trim();

		if (trimmedName.length === 0) {
			return;
		}

		const nowIsoString: string = new Date().toISOString();

		const note: NoteRecord = {
			id: loadedNoteId,
			name: trimmedName,
			content: currentContent,
			thumbnail: null,
			created_at: createdAt || nowIsoString,
			last_updated_at: nowIsoString,
		};

		await upsertNote(note);

		noteName = trimmedName;
		lastSavedContent = currentContent;
		lastUpdatedAt = nowIsoString;
		isNew = false;

		showTemporarySavedState();
	}

	$effect((): void => {
		const nextNoteId: string = data.noteId;

		void switchToNote(nextNoteId);
	});

	onMount((): (() => void) => {
		autosaveInterval = setInterval((): void => {
			if (loadedNoteId) {
				void saveIfChanged(loadedNoteId, currentContent);
			}
		}, 2000);

		const handleSaveShortcut = (event: KeyboardEvent): void => {
			const isSaveShortcut: boolean =
				(event.ctrlKey || event.metaKey) &&
				event.key.toLowerCase() === "s";

			if (!isSaveShortcut) {
				return;
			}

			event.preventDefault();

			void saveCurrentNoteFromShortcut();
		};

		const handleVisibilityChange = (): void => {
			if (document.visibilityState === "hidden" && loadedNoteId) {
				void flushCurrentNote(loadedNoteId);
			}
		};

		window.addEventListener("keydown", handleSaveShortcut);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		beforeNavigate((): void => {
			if (loadedNoteId) {
				void flushCurrentNote(loadedNoteId);
			}
		});

		return (): void => {
			if (autosaveInterval) {
				clearInterval(autosaveInterval);
			}

			clearHideSaveFeedbackTimeout();
			clearPreviewCooldownTimeout();

			window.removeEventListener("keydown", handleSaveShortcut);
			document.removeEventListener(
				"visibilitychange",
				handleVisibilityChange,
			);
		};
	});

	onDestroy((): void => {
		clearHideSaveFeedbackTimeout();
		clearPreviewCooldownTimeout();
	});
</script>

{#if hasLoaded}
	{#key editorKey}
		<NoteEditor
			noteId={data.noteId}
			{initialContent}
			{noteName}
			onContentChange={handleContentChange}
			onRenameNote={handleRenameNote}
		/>
	{/key}
{/if}

{#if showSaveFeedback}
	<div class="save-feedback" class:error={saveStatus === "error"}>
		{#if saveStatus === "saving"}
			<div class="save-icon sync-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none">
					<path
						d="M20 12a8 8 0 0 0-13.66-5.66"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<path
						d="M4 4v4h4"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M4 12a8 8 0 0 0 13.66 5.66"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<path
						d="M20 20v-4h-4"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</div>
		{:else if saveStatus === "saved"}
			<div class="save-icon success-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none">
					<path
						d="M5 13l4 4L19 7"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</div>
		{:else if saveStatus === "error"}
			<div class="save-icon error-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none">
					<path
						d="M12 8v5"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
					/>
					<circle cx="12" cy="16.5" r="1" fill="currentColor" />
					<path
						d="M10.3 3.84 2.82 17a2 2 0 0 0 1.74 3h14.88a2 2 0 0 0 1.74-3L13.7 3.84a2 2 0 0 0-3.48 0Z"
						stroke="currentColor"
						stroke-width="2"
						stroke-linejoin="round"
					/>
				</svg>
			</div>
		{/if}
	</div>
{/if}

<div
	bind:this={previewHostElement}
	class="preview-host"
	aria-hidden="true"
></div>

<style>
	.save-feedback {
		position: fixed;
		right: max(0rem, env(safe-area-inset-right));
		bottom: max(0rem, env(safe-area-inset-bottom));
		z-index: 9999;

		display: inline-flex;
		align-items: center;

		padding: 0.3rem 0.4rem;
		border-radius: var(--radius-float);

		background: var(--color-surface);
		border: 1px solid var(--color-border);
		box-shadow: var(--shadow-soft);

		color: var(--color-text);
		font-size: 0.82rem;
		line-height: 1.2;
		backdrop-filter: blur(var(--blur-surface));

		max-width: calc(100vw - 2rem);
		box-sizing: border-box;
	}

	.save-feedback.error {
		border-color: color-mix(
			in srgb,
			var(--color-accent) 35%,
			var(--color-border)
		);
	}

	.save-icon {
		width: 1rem;
		height: 1rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
	}

	.save-icon svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.sync-icon {
		animation: save-spin 1.2s linear infinite;
	}

	.success-icon {
		color: var(--color-editor-task-check);
	}

	.error-icon {
		color: #dc2626;
	}

	.preview-host {
		position: fixed;
		left: -10000px;
		top: -10000px;
		width: 500px;
		pointer-events: none;
		opacity: 0;
	}

	:global(.note-preview-render) {
		width: var(--note-preview-width);
		height: var(--note-preview-height);
		max-height: var(--note-preview-height);
		min-width: var(--note-preview-width);
		overflow: hidden;
		background: var(--color-bg-top);
		color: var(--color-text);
		padding: 1.25rem;
		box-sizing: border-box;
		border-radius: 0.75rem;
	}

	:global(.note-preview-render .tiptap-editor) {
		font-size: 16px;
		line-height: 1.65;
		min-height: auto;
	}

	:global(.note-preview-render .tiptap-editor pre) {
		background: #282c34;
		color: #abb2bf;
		padding: 0.9rem 1rem;
		border-radius: 0.75rem;
		overflow: hidden;
		white-space: pre-wrap;
		word-break: break-word;
	}

	:global(.note-preview-render .tiptap-editor code) {
		color: inherit;
	}

	@keyframes save-spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>

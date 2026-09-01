<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount, onDestroy, tick } from "svelte";
    import type { NoteRecord } from "$lib/types/note";
    import {
        getAllNotes,
        getNotePreviewFilePath,
        deleteNote,
        upsertNote,
    } from "$lib/services/note-service";
    import { convertFileSrc } from "@tauri-apps/api/core";
    import { longPress, type LongPressEvent } from "$lib/actions/longPress";
    import { isMobilePlatform } from "$lib/device/platform";

    type ContextMenuState = {
        noteId: string;
        x: number;
        y: number;
        deleteReadyAt: number;
    } | null;

    let suppressNextNoteClickId: string | null = $state(null);

    let notes: NoteRecord[] = $state([]);
    let searchValue: string = $state("");
    let isLoading: boolean = $state(true);
    let errorMessage: string | null = $state(null);
    let notePreviewUrls: Record<string, string> = $state({});

    let contextMenu: ContextMenuState = $state(null);
    let deleteCountdownMs: number = $state(0);
    let deleteCountdownIntervalId: number | null = $state(null);

    let thumbnailRefreshIntervalId: number | null = $state(null);
    let thumbnailRefreshTimeoutId: number | null = $state(null);

    let isRenameDialogOpen: boolean = $state(false);
    let renameNoteId: string | null = $state(null);
    let renameValue: string = $state("");
    let renameInputElement: HTMLInputElement | null = $state(null);
    let isRenameSaving: boolean = $state(false);

    let searchInputElement: HTMLInputElement | null = $state(null);

    const RECENT_NOTE_WINDOW_MS: number = 5000;
    const THUMBNAIL_REFRESH_INTERVAL_MS: number = 1000;
    const DELETE_DELAY_MS: number = 2000;

    function focusSearchInput(): void {
        searchInputElement?.focus();
        searchInputElement?.select();
    }

    async function loadNotes(): Promise<void> {
        try {
            isLoading = true;
            errorMessage = null;

            const loadedNotes: NoteRecord[] = await getAllNotes();
            notes = loadedNotes;
            await loadPreviewUrls(loadedNotes);
            startRecentThumbnailRefresh(loadedNotes);
        } catch (error: unknown) {
            errorMessage =
                error instanceof Error ? error.message : "Failed to load notes";
        } finally {
            isLoading = false;
        }
    }

    function openNote(noteId: string): void {
        void goto(`/note/${noteId}`);
    }

    async function openRenameDialog(noteId: string): Promise<void> {
        const noteToRename: NoteRecord | undefined = notes.find(
            (note: NoteRecord): boolean => note.id === noteId,
        );

        if (!noteToRename) {
            return;
        }

        closeContextMenu();

        renameNoteId = noteId;
        renameValue = noteToRename.name;
        isRenameDialogOpen = true;

        await tick();
        renameInputElement?.focus();
        renameInputElement?.select();
    }

    function closeRenameDialog(): void {
        isRenameDialogOpen = false;
        renameNoteId = null;
        renameValue = "";
        isRenameSaving = false;
    }

    async function submitRenameDialog(): Promise<void> {
        if (!renameNoteId || isRenameSaving) {
            return;
        }

        const trimmedName: string = renameValue.trim();

        if (trimmedName.length === 0) {
            errorMessage = "Note name cannot be empty";
            return;
        }

        const existingNote: NoteRecord | undefined = notes.find(
            (note: NoteRecord): boolean => note.id === renameNoteId,
        );

        if (!existingNote) {
            errorMessage = "Note not found";
            closeRenameDialog();
            return;
        }

        isRenameSaving = true;
        errorMessage = null;

        const updatedNote: NoteRecord = {
            ...existingNote,
            name: trimmedName,
        };

        try {
            await upsertNote(updatedNote);

            notes = notes.map(
                (note: NoteRecord): NoteRecord =>
                    note.id === renameNoteId ? updatedNote : note,
            );

            closeRenameDialog();
        } catch (error: unknown) {
            isRenameSaving = false;
            errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to rename note";
        }
    }

    function clearDeleteCountdown(): void {
        if (deleteCountdownIntervalId !== null) {
            window.clearInterval(deleteCountdownIntervalId);
            deleteCountdownIntervalId = null;
        }

        deleteCountdownMs = 0;
    }

    function startDeleteCountdown(deleteReadyAt: number): void {
        clearDeleteCountdown();

        const updateCountdown = (): void => {
            const remainingMs: number = Math.max(0, deleteReadyAt - Date.now());

            deleteCountdownMs = remainingMs;

            if (remainingMs <= 0 && deleteCountdownIntervalId !== null) {
                window.clearInterval(deleteCountdownIntervalId);
                deleteCountdownIntervalId = null;
            }
        };

        updateCountdown();

        if (deleteCountdownMs > 0) {
            deleteCountdownIntervalId = window.setInterval(
                updateCountdown,
                100,
            );
        }
    }

    const isDeleteReady: boolean = $derived(
        contextMenu !== null && deleteCountdownMs <= 0,
    );

    function openContextMenu(
        noteId: string,
        clientX: number,
        clientY: number,
    ): void {
        const menuWidth: number = 160;
        const menuHeight: number = 120;

        const x: number = Math.min(clientX, window.innerWidth - menuWidth);
        const y: number = Math.min(clientY, window.innerHeight - menuHeight);

        const deleteReadyAt: number = Date.now() + DELETE_DELAY_MS;

        contextMenu = {
            noteId,
            x,
            y,
            deleteReadyAt,
        };

        startDeleteCountdown(deleteReadyAt);
    }

    function handleContextMenu(event: MouseEvent, noteId: string): void {
        event.preventDefault();

        // Android/iOS use our long-press action instead.
        if (isMobilePlatform) {
            return;
        }

        openContextMenu(noteId, event.clientX, event.clientY);
    }

    function handleLongPress(event: LongPressEvent, noteId: string): void {
        if (event.pointerType === "mouse") {
            return;
        }

        suppressNextNoteClickId = noteId;

        openContextMenu(noteId, event.clientX, event.clientY);
    }

    function handleNoteClick(noteId: string): void {
        if (suppressNextNoteClickId === noteId) {
            suppressNextNoteClickId = null;
            return;
        }

        openNote(noteId);
    }

    function closeContextMenu(): void {
        contextMenu = null;
        clearDeleteCountdown();
    }

    async function deleteSelectedNote(): Promise<void> {
        if (!contextMenu || !isDeleteReady) {
            return;
        }

        const noteIdToDelete: string = contextMenu.noteId;

        closeContextMenu();

        try {
            await deleteNote(noteIdToDelete);

            notes = notes.filter(
                (note: NoteRecord): boolean => note.id !== noteIdToDelete,
            );

            const nextPreviewUrls: Record<string, string> = {
                ...notePreviewUrls,
            };
            delete nextPreviewUrls[noteIdToDelete];
            notePreviewUrls = nextPreviewUrls;
        } catch (error: unknown) {
            errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to delete note";
        }
    }

    function getRecentNotes(noteList: NoteRecord[]): NoteRecord[] {
        const nowMs: number = Date.now();

        return noteList.filter((note: NoteRecord): boolean => {
            const updatedAtMs: number = new Date(
                note.last_updated_at,
            ).getTime();
            return nowMs - updatedAtMs < RECENT_NOTE_WINDOW_MS;
        });
    }

    function stopRecentThumbnailRefresh(): void {
        if (thumbnailRefreshIntervalId !== null) {
            window.clearInterval(thumbnailRefreshIntervalId);
            thumbnailRefreshIntervalId = null;
        }

        if (thumbnailRefreshTimeoutId !== null) {
            window.clearTimeout(thumbnailRefreshTimeoutId);
            thumbnailRefreshTimeoutId = null;
        }
    }

    function startRecentThumbnailRefresh(noteList: NoteRecord[]): void {
        stopRecentThumbnailRefresh();

        const refreshRecentNotes = async (): Promise<void> => {
            const recentNotes: NoteRecord[] = getRecentNotes(noteList);

            if (recentNotes.length === 0) {
                stopRecentThumbnailRefresh();
                return;
            }

            await Promise.all(
                recentNotes.map(
                    async (note: NoteRecord): Promise<void> =>
                        refreshPreviewUrlForNote(note),
                ),
            );
        };

        void refreshRecentNotes();

        thumbnailRefreshIntervalId = window.setInterval((): void => {
            void refreshRecentNotes();
        }, THUMBNAIL_REFRESH_INTERVAL_MS);

        thumbnailRefreshTimeoutId = window.setTimeout((): void => {
            stopRecentThumbnailRefresh();
        }, RECENT_NOTE_WINDOW_MS);
    }

    async function refreshPreviewUrlForNote(note: NoteRecord): Promise<void> {
        try {
            const previewFilePath: string | null = await getNotePreviewFilePath(
                note.id,
            );

            if (!previewFilePath) {
                return;
            }

            const previewUrl: string = convertFileSrc(previewFilePath);
            const cacheKey: number = new Date(note.last_updated_at).getTime();

            notePreviewUrls = {
                ...notePreviewUrls,
                [note.id]: `${previewUrl}?v=${cacheKey}`,
            };
        } catch (error: unknown) {
            console.error(
                `failed to refresh preview for note ${note.id}:`,
                error,
            );
        }
    }

    function normalizeValue(value: string): string {
        return value.trim().toLocaleLowerCase();
    }

    async function loadPreviewUrls(noteList: NoteRecord[]): Promise<void> {
        const nextPreviewUrls: Record<string, string> = {};

        for (const note of noteList) {
            try {
                const previewFilePath: string | null =
                    await getNotePreviewFilePath(note.id);

                if (previewFilePath) {
                    const previewUrl: string = convertFileSrc(previewFilePath);
                    const cacheKey: number = new Date(
                        note.last_updated_at,
                    ).getTime();

                    nextPreviewUrls[note.id] = `${previewUrl}?v=${cacheKey}`;
                }
            } catch (error: unknown) {
                console.error(
                    `failed to load preview for note ${note.id}:`,
                    error,
                );
            }
        }

        notePreviewUrls = nextPreviewUrls;
    }

    const normalizedSearchValue: string = $derived(normalizeValue(searchValue));

    const sortedNotes: NoteRecord[] = $derived(
        [...notes].sort(
            (a: NoteRecord, b: NoteRecord): number =>
                new Date(b.last_updated_at).getTime() -
                new Date(a.last_updated_at).getTime(),
        ),
    );

    const filteredNotes: NoteRecord[] = $derived(
        normalizedSearchValue.length === 0
            ? sortedNotes
            : sortedNotes.filter((note: NoteRecord) => {
                  const searchableText: string = `${note.name} ${note.content}`
                      .replace(/\s+/g, " ")
                      .toLocaleLowerCase();

                  return searchableText.includes(normalizedSearchValue);
              }),
    );

    onMount((): (() => void) => {
        const handleFocusNotesSearch = (): void => {
            focusSearchInput();
        };

        window.addEventListener("focus-notes-search", handleFocusNotesSearch);

        void loadNotes();

        return (): void => {
            window.removeEventListener(
                "focus-notes-search",
                handleFocusNotesSearch,
            );
        };
    });

    onDestroy((): void => {
        stopRecentThumbnailRefresh();
        clearDeleteCountdown();
    });
</script>

<svelte:window
    onkeydown={(event: KeyboardEvent): void => {
        if (event.key === "Escape") {
            closeContextMenu();
        }
    }}
/>

<div class="notes-page">
    <div class="page-header">
        <div class="page-title-row">
            <h1 class="page-title">Notes</h1>

            {#if isMobilePlatform}
                <button
                    type="button"
                    class="mobile-settings-icon"
                    aria-label="Settings"
                    title="Settings"
                    onclick={(): void => {
                        void goto("/settings");
                    }}
                >
                    ⚙
                </button>
            {/if}
        </div>

        <div class="search-bar-row">
            <div class="search-bar-wrapper">
                <input
                    bind:this={searchInputElement}
                    class="search-input"
                    type="text"
                    bind:value={searchValue}
                    placeholder="Search notes..."
                    aria-label="Search notes"
                />
            </div>
        </div>
    </div>

    {#if isLoading}
        <p class="status-text">Loading notes...</p>
    {:else if errorMessage}
        <p class="status-text error">{errorMessage}</p>
    {:else if filteredNotes.length === 0 && searchValue.trim().length > 0}
        <p class="status-text">No notes match your search.</p>
    {:else if notes.length === 0}
        <p class="status-text">No notes yet.</p>
    {:else}
        <div class="notes-grid">
            {#each filteredNotes as note (note.id)}
                <div class="note-tile-wrapper">
                    <button
                        type="button"
                        class="note-tile"
                        onclick={() => handleNoteClick(note.id)}
                        oncontextmenu={(event: MouseEvent) =>
                            handleContextMenu(event, note.id)}
                        use:longPress={{
                            duration: 500,
                            movementTolerance: 10,
                            onLongPress: (event: LongPressEvent): void =>
                                handleLongPress(event, note.id),
                        }}
                        aria-label={`Open note ${note.name}`}
                    >
                        <div class="note-thumbnail-frame">
                            {#if notePreviewUrls[note.id]}
                                <img
                                    class="note-thumbnail-image"
                                    src={notePreviewUrls[note.id]}
                                    alt={`Preview of ${note.name}`}
                                    loading="lazy"
                                    draggable="false"
                                />
                            {:else}
                                <div class="note-thumbnail-placeholder"></div>
                            {/if}
                        </div>

                        <div class="note-name">
                            {note.name}
                        </div>
                    </button>
                </div>
            {/each}
        </div>
    {/if}

    {#if contextMenu}
        <div
            class="context-menu-backdrop"
            role="presentation"
            onpointerdown={closeContextMenu}
        >
            <div
                class="context-menu"
                style={`left: ${contextMenu.x}px; top: ${contextMenu.y}px;`}
                onpointerdown={(event: PointerEvent): void => {
                    event.stopPropagation();
                }}
                role="button"
                tabindex="0"
            >
                <button
                    type="button"
                    class="context-menu-item"
                    onclick={() => {
                        if (!contextMenu) {
                            return;
                        }

                        void openRenameDialog(contextMenu.noteId);
                    }}
                >
                    Rename
                </button>

                <button
                    type="button"
                    class="context-menu-item danger"
                    class:delete-locked={!isDeleteReady}
                    onclick={deleteSelectedNote}
                >
                    {isDeleteReady
                        ? "Delete"
                        : `Delete (${(deleteCountdownMs / 1000).toFixed(1)}s)`}
                </button>

                <div class="context-menu-progress" class:hidden={isDeleteReady}>
                    <div
                        class="context-menu-progress-fill"
                        style={`transform: scaleX(${Math.max(
                            0,
                            Math.min(
                                1,
                                1 - deleteCountdownMs / DELETE_DELAY_MS,
                            ),
                        )});`}
                    ></div>
                </div>
            </div>
        </div>
    {/if}
</div>

{#if isRenameDialogOpen}
    <div
        class="dialog-backdrop"
        onclick={closeRenameDialog}
        onkeydown={(event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeRenameDialog();
            }
        }}
        role="button"
        tabindex="0"
    >
        <div
            class="rename-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Rename note"
            tabindex="-1"
            onclick={(event: MouseEvent): void => event.stopPropagation()}
            onkeydown={(event: KeyboardEvent): void => {
                if (event.key === "Escape") {
                    event.stopPropagation();
                    closeRenameDialog();
                }
            }}
        >
            <div class="rename-dialog-header">
                <h3>Rename note</h3>
            </div>

            <div class="rename-dialog-body">
                <label class="field">
                    <span class="field-label">Name</span>
                    <input
                        bind:this={renameInputElement}
                        bind:value={renameValue}
                        type="text"
                        placeholder="Note name"
                        onkeydown={(event: KeyboardEvent): void => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                void submitRenameDialog();
                            }

                            if (event.key === "Escape") {
                                event.preventDefault();
                                closeRenameDialog();
                            }
                        }}
                    />
                </label>
            </div>
        </div>
    </div>
{/if}

<style>
    .notes-page {
        padding: 1.5rem;
        color: var(--color-text);
    }

    .page-header {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .page-title {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 700;
        line-height: 1.2;
        color: var(--color-heading);
    }

    .search-bar-row {
        display: flex;
        justify-content: center;
        width: 100%;
    }

    .search-bar-wrapper {
        width: 100%;
        max-width: 28rem;
    }

    .search-input {
        width: 100%;
        padding: 0.75rem 1rem;
        font-size: 1rem;
        line-height: 1.5;
        border: 0.0625rem solid var(--color-border);
        border-radius: var(--radius-float);
        background: var(--color-surface);
        color: var(--color-text-strong);
        box-sizing: border-box;
        box-shadow: var(--shadow-soft);
        backdrop-filter: blur(var(--blur-surface));
        -webkit-backdrop-filter: blur(var(--blur-surface));
        transition:
            border-color 120ms ease,
            box-shadow 120ms ease,
            background 120ms ease;
    }

    .search-input::placeholder {
        color: var(--color-text-muted);
    }

    .search-input:hover {
        border-color: var(--color-border-hover);
        background: var(--color-surface-strong);
        box-shadow: var(--shadow-soft-hover);
    }

    .search-input:focus {
        outline: none;
        border-color: var(--color-accent);
        background: var(--color-surface-strong);
        box-shadow:
            0 0 0 0.125rem
                color-mix(in srgb, var(--color-accent) 20%, transparent),
            var(--shadow-soft-hover);
    }

    .status-text {
        font-size: 1rem;
        line-height: 1.5;
        color: var(--color-text-muted);
    }

    .status-text.error {
        color: var(--color-accent);
    }

    .notes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
        gap: 1rem;
        align-items: start;
    }

    .note-tile {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        width: 100%;
        padding: 0;
        border: none;
        background: transparent;
        text-align: left;
        cursor: pointer;
        color: inherit;

        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }

    .note-thumbnail-placeholder {
        width: 100%;
        aspect-ratio: var(--note-preview-aspect-ratio);
        border-radius: var(--radius-float);
        background: linear-gradient(
            135deg,
            var(--color-surface),
            var(--color-button-bg)
        );
        border: 0.0625rem solid var(--color-border);
        box-shadow: var(--shadow-soft);
        backdrop-filter: blur(var(--blur-surface));
        -webkit-backdrop-filter: blur(var(--blur-surface));
        transition:
            transform 120ms ease,
            box-shadow 120ms ease,
            border-color 120ms ease,
            background 120ms ease;
    }

    .note-name {
        font-size: 1rem;
        font-weight: 600;
        line-height: 1.4;
        color: var(--color-title);
        word-break: break-word;
    }

    @media (hover: hover) and (pointer: fine) {
        .note-tile:hover .note-thumbnail-placeholder {
            transform: translateY(-0.125rem);
            border-color: var(--color-border-hover);
            background: linear-gradient(
                135deg,
                var(--color-surface-strong),
                var(--color-button-bg-hover)
            );
            box-shadow: var(--shadow-soft-hover);
        }

        .note-tile:hover .note-name {
            color: var(--color-heading);
        }

        .note-tile:hover .note-thumbnail-frame {
            transform: translateY(-0.125rem);
            border-color: var(--color-border-hover);
            background: linear-gradient(
                135deg,
                var(--color-surface-strong),
                var(--color-button-bg-hover)
            );
            box-shadow: var(--shadow-soft-hover);
        }
    }

    .note-tile:focus-visible {
        outline: 0.125rem solid var(--color-accent);
        outline-offset: 0.25rem;
        border-radius: var(--radius-float);
    }

    .note-thumbnail-frame {
        width: 100%;
        border-radius: var(--radius-float);
        overflow: hidden;
        border: 0.0625rem solid var(--color-border);
        box-shadow: var(--shadow-soft);
        background: var(--color-bg-top);
    }

    .note-thumbnail-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        background: var(--color-bg-top);
        padding: 0;
        box-sizing: border-box;
    }

    .note-thumbnail-frame,
    .note-thumbnail-placeholder {
        aspect-ratio: var(--note-preview-aspect-ratio);
    }

    .note-tile:hover .note-thumbnail-frame {
        transform: translateY(-0.125rem);
        border-color: var(--color-border-hover);
        background: linear-gradient(
            135deg,
            var(--color-surface-strong),
            var(--color-button-bg-hover)
        );
        box-shadow: var(--shadow-soft-hover);
    }

    .context-menu {
        position: fixed;
        z-index: 1000;
        min-width: 10rem;
        padding: 0.375rem;

        border: 0.0625rem solid var(--color-border);
        border-radius: var(--radius-float);
        background: var(--color-surface-strong);
        box-shadow: var(--shadow-soft-hover);
    }

    .context-menu-item {
        display: block;
        width: 100%;
        padding: 0.625rem 0.75rem;
        border: none;
        border-radius: calc(var(--radius-float) * 0.7);
        background: transparent;
        color: var(--color-text-strong);
        text-align: left;
        cursor: pointer;
        font-size: 0.95rem;
    }

    .context-menu-item:hover {
        background: var(--color-button-bg-hover);
    }

    .context-menu-item.danger {
        color: var(--color-accent);
    }
    .context-menu-item.disabled,
    .context-menu-item:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }

    .context-menu-progress {
        width: 100%;
        height: 0.25rem;
        margin-top: 0.25rem;
        border-radius: 999rem;
        overflow: hidden;
        background: var(--color-surface);
        border: 0.0625rem solid var(--color-border);
    }

    .context-menu-progress-fill {
        width: 100%;
        height: 100%;
        transform-origin: left center;
        transition: transform 50ms linear;
        background: var(--color-accent);
    }

    .dialog-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(0, 0, 0, 0.08);
        backdrop-filter: blur(var(--blur-surface));
        -webkit-backdrop-filter: blur(var(--blur-surface));
    }

    .rename-dialog {
        width: min(28rem, 100%);
        border-radius: var(--radius-float);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        box-shadow: var(--shadow-float);
        backdrop-filter: blur(var(--blur-surface));
        -webkit-backdrop-filter: blur(var(--blur-surface));
    }

    .rename-dialog-header {
        padding: 0.9rem 1rem 0.6rem;
        border-bottom: 1px solid var(--color-border);
    }

    .rename-dialog-header h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-title);
    }

    .rename-dialog-body {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        padding: 1rem;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .field-label {
        font-size: 0.82rem;
        font-weight: 500;
        color: var(--color-text-muted);
    }

    .field input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-button);
        background: var(--color-button-bg);
        color: var(--color-text);
        padding: 0.65rem 0.75rem;
        font-size: 0.9rem;
    }

    .field input:focus {
        outline: none;
        border-color: var(--color-accent);
        box-shadow: 0 0 0 2px var(--color-editor-link-bg);
    }

    .note-tile-wrapper {
        position: relative;
        min-width: 0;
    }

    .context-menu-item.delete-locked {
        opacity: 0.55;
    }

    .context-menu-progress.hidden {
        visibility: hidden;
    }

    .context-menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 999;
    }

    .context-menu {
        position: fixed;
        z-index: 1000;
    }

    .note-tile,
    .context-menu {
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }

    .note-name {
        user-select: none;
        -webkit-user-select: none;
    }

    .note-tile {
        -webkit-tap-highlight-color: transparent;
    }
    
    .page-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }

    .mobile-settings-icon {
        padding: 0;

        border: none;
        background: transparent;

        color: var(--color-accent);

        font: inherit;
        font-size: 1.35rem;
        line-height: 1;

        cursor: pointer;

        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
    }
</style>

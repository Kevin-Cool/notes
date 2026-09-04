<script lang="ts">
    import { tick } from "svelte";
    import type { NoteRecord } from "$lib/types/note";
    import {
        getAllNotes,
        getNotePreviewFilePath,
    } from "$lib/services/note-service";
    import { convertFileSrc } from "@tauri-apps/api/core";

    type LinkType = "external" | "note";

    let {
        isOpen,
        initialType = "external",
        initialValue = "",
        onClose,
        onSubmit,
        onRemove,
        currentNoteId,
    }: {
        isOpen: boolean;
        initialType?: LinkType;
        initialValue?: string;
        onClose?: () => void;
        onSubmit?: (detail: {
            type: LinkType;
            value: string;
            navigateToNoteId?: string;
        }) => void;
        onRemove?: () => void;
        currentNoteId?: string;
    } = $props();

    // svelte-ignore state_referenced_locally
    let linkType: LinkType = $state(initialType);
    let externalValue: string = $state("");
    let noteSearchValue: string = $state("");
    let selectedNoteId: string = $state("");
    let notes: NoteRecord[] = $state([]);
    let isLoadingNotes: boolean = $state(false);
    let errorMessage: string | null = $state(null);
    let inputElement: HTMLInputElement | null = $state(null);

    let previewUrls: Record<string, string> = $state({});

    function createAndSubmitNewNoteLink(): void {
        const newNoteId: string = crypto.randomUUID();

        onSubmit?.({
            type: "note",
            value: newNoteId,
            navigateToNoteId: newNoteId,
        });
    }

    const normalizedSearchValue: string = $derived(
        noteSearchValue.trim().toLocaleLowerCase(),
    );

    const selectableNotes: NoteRecord[] = $derived(
        notes.filter((note: NoteRecord): boolean => note.id !== currentNoteId),
    );

    const recentNotes: NoteRecord[] = $derived(
        [...selectableNotes]
            .sort((left: NoteRecord, right: NoteRecord): number => {
                return (
                    new Date(right.updated_at).getTime() -
                    new Date(left.updated_at).getTime()
                );
            })
            .slice(0, 5),
    );

    const visibleNotes: NoteRecord[] = $derived(
        normalizedSearchValue.length === 0
            ? recentNotes
            : selectableNotes
                  .filter((note: NoteRecord): boolean => {
                      const searchableText: string =
                          `${note.name} ${note.content}`
                              .replace(/\s+/g, " ")
                              .toLocaleLowerCase();

                      return searchableText.includes(normalizedSearchValue);
                  })
                  .sort((left: NoteRecord, right: NoteRecord): number => {
                      return (
                          new Date(right.updated_at).getTime() -
                          new Date(left.updated_at).getTime()
                      );
                  })
                  .slice(0, 8),
    );

    let wasOpen: boolean = false;

    $effect((): void => {
        if (!isOpen) {
            wasOpen = false;
            return;
        }

        if (wasOpen) {
            return;
        }

        wasOpen = true;

        linkType = initialType;
        externalValue = initialType === "external" ? initialValue : "";
        selectedNoteId = initialType === "note" ? initialValue : "";
        noteSearchValue = "";

        void tick().then((): void => {
            inputElement?.focus();
        });

        if (initialType === "note") {
            void loadNotes();
        }
    });

    async function loadPreviewUrls(noteList: NoteRecord[]): Promise<void> {
        const nextPreviewUrls: Record<string, string> = {};

        for (const note of noteList) {
            try {
                const previewFilePath: string | null =
                    await getNotePreviewFilePath(note.id);

                if (!previewFilePath) {
                    continue;
                }

                const previewUrl: string = convertFileSrc(previewFilePath);
                const cacheKey: number = new Date(
                    note.updated_at,
                ).getTime();

                nextPreviewUrls[note.id] = `${previewUrl}?v=${cacheKey}`;
            } catch (error: unknown) {
                console.error(
                    `failed to load overlay preview for note ${note.id}:`,
                    error,
                );
            }
        }

        previewUrls = nextPreviewUrls;
    }

    async function loadNotes(): Promise<void> {
        if (notes.length > 0 || isLoadingNotes) {
            return;
        }

        try {
            isLoadingNotes = true;
            errorMessage = null;

            const loadedNotes: NoteRecord[] = await getAllNotes();
            notes = loadedNotes;

            await loadPreviewUrls(loadedNotes);
        } catch (error: unknown) {
            errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to load notes.";
        } finally {
            isLoadingNotes = false;
        }
    }

    function switchType(nextType: LinkType): void {
        linkType = nextType;

        if (nextType === "external") {
            selectedNoteId = "";
            noteSearchValue = "";
        }

        if (nextType === "note") {
            externalValue = "";
            void loadNotes();
        }

        void tick().then((): void => {
            inputElement?.focus();
        });
    }

    function submit(): void {
        if (linkType === "external") {
            onSubmit?.({
                type: "external",
                value: externalValue.trim(),
            });
            return;
        }

        onSubmit?.({
            type: "note",
            value: selectedNoteId.trim(),
        });
    }

    function selectNote(note: NoteRecord): void {
        selectedNoteId = note.id;
        noteSearchValue = note.name;
    }

    function getSelectedNoteName(): string {
        const selectedNote: NoteRecord | undefined = notes.find(
            (note: NoteRecord): boolean => note.id === selectedNoteId,
        );

        return selectedNote?.name ?? selectedNoteId;
    }

    function handleBackdropKeydown(event: KeyboardEvent): void {
        if (event.key === "Escape") {
            event.preventDefault();
            onClose?.();
        }
    }

    function handleInputKeydown(event: KeyboardEvent): void {
        if (event.key === "Enter") {
            event.preventDefault();

            if (linkType === "note" && !selectedNoteId && visibleNotes[0]) {
                selectNote(visibleNotes[0]);
                return;
            }

            submit();
        }

        if (event.key === "Escape") {
            event.preventDefault();
            onClose?.();
        }
    }
</script>

{#if isOpen}
    <div
        class="dialog-backdrop"
        onclick={onClose}
        onkeydown={handleBackdropKeydown}
        role="presentation"
    >
        <div
            class="link-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Insert link"
            tabindex="-1"
            onclick={(event: MouseEvent): void => event.stopPropagation()}
            onkeydown={(event: KeyboardEvent): void => event.stopPropagation()}
        >
            <div class="link-dialog-header">
                <h3>Insert link</h3>
            </div>

            <div class="link-dialog-body">
                <div class="field">
                    <span class="field-label">Link type</span>

                    <div class="link-type-picker">
                        <button
                            type="button"
                            class="link-type-button"
                            class:selected={linkType === "external"}
                            onclick={() => switchType("external")}
                            aria-pressed={linkType === "external"}
                        >
                            <span class="link-type-icon">🌐</span>
                            <span class="link-type-text">Website</span>
                        </button>

                        <button
                            type="button"
                            class="link-type-button"
                            class:selected={linkType === "note"}
                            onclick={() => switchType("note")}
                            aria-pressed={linkType === "note"}
                        >
                            <span class="link-type-icon">🗒️</span>
                            <span class="link-type-text">Note</span>
                        </button>
                    </div>
                </div>

                {#if linkType === "external"}
                    <label class="field">
                        <span class="field-label">URL</span>
                        <input
                            bind:this={inputElement}
                            bind:value={externalValue}
                            type="text"
                            placeholder="https://example.com"
                            onkeydown={handleInputKeydown}
                        />
                    </label>
                {:else}
                    <label class="field">
                        <span class="field-label">Search note</span>
                        <input
                            bind:this={inputElement}
                            bind:value={noteSearchValue}
                            type="text"
                            placeholder="Search notes..."
                            oninput={() => {
                                selectedNoteId = "";
                            }}
                            onkeydown={handleInputKeydown}
                        />
                    </label>
                    <button
                        type="button"
                        class="create-note-link-button"
                        onclick={createAndSubmitNewNoteLink}
                    >
                        <span class="create-note-link-icon">＋</span>
                        <span>Create new linked note</span>
                    </button>
                    {#if selectedNoteId}
                        <div class="selected-note">
                            Selected: {getSelectedNoteName()}
                        </div>
                    {/if}

                    {#if isLoadingNotes}
                        <p class="status-text">Loading notes...</p>
                    {:else if errorMessage}
                        <p class="status-text error">{errorMessage}</p>
                    {:else if normalizedSearchValue.length > 0 && visibleNotes.length === 0}
                        <p class="status-text">No notes found.</p>
                    {:else if visibleNotes.length > 0}
                        <div class="note-result-list">
                            {#each visibleNotes as note (note.id)}
                                <button
                                    type="button"
                                    class="note-result"
                                    class:selected={selectedNoteId === note.id}
                                    onclick={() => selectNote(note)}
                                >
                                    <div class="note-result-thumbnail-frame">
                                        {#if previewUrls[note.id]}
                                            <img
                                                class="note-result-thumbnail-image"
                                                src={previewUrls[note.id]}
                                                alt={`Preview of ${note.name}`}
                                                loading="lazy"
                                            />
                                        {:else}
                                            <div
                                                class="note-result-thumbnail-placeholder"
                                            ></div>
                                        {/if}
                                    </div>

                                    <div class="note-result-text">
                                        <span class="note-result-title">
                                            {note.name}
                                        </span>

                                        <span class="note-result-date">
                                            {new Date(
                                                note.updated_at,
                                            ).toLocaleString()}
                                        </span>
                                    </div>
                                </button>
                            {/each}
                        </div>
                    {/if}
                {/if}
            </div>

            <div class="link-dialog-footer">
                <button type="button" class="danger-button" onclick={onRemove}>
                    Remove link
                </button>

                <button
                    type="button"
                    class="primary-button"
                    onclick={submit}
                    disabled={linkType === "note" &&
                        selectedNoteId.trim().length === 0}
                >
                    Save
                </button>
            </div>
        </div>
    </div>
{/if}

<style>

    .link-dialog {
        width: min(32rem, 100%);
        max-height: min(80vh, 44rem);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: var(--radius-float);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        box-shadow: var(--shadow-float);
        backdrop-filter: blur(var(--blur-surface));
    }

    .link-dialog-header {
        padding: 0.9rem 1rem 0.6rem;
        border-bottom: 1px solid var(--color-border);
    }

    .link-dialog-header h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-title);
    }

    .link-dialog-body {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        padding: 1rem;
        overflow-y: auto;
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

    .link-type-picker {
        display: flex;
        gap: 0.5rem;
    }

    .link-type-button {
        flex: 1;
        min-width: 0;
        height: auto;
        padding: 0.7rem 0.8rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-button);
        background: var(--color-button-bg);
        color: var(--color-text);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        text-align: center;
        cursor: pointer;
    }

    .link-type-button:hover {
        background: var(--color-button-bg-hover);
        border-color: var(--color-border-hover);
    }

    .link-type-button.selected {
        background: var(--color-editor-link-bg);
        color: var(--color-accent);
        border-color: var(--color-accent);
        box-shadow: var(--shadow-soft);
    }

    .link-type-icon {
        font-size: 1rem;
        line-height: 1;
    }

    .link-type-text {
        font-size: 0.8rem;
        line-height: 1.1;
    }

    .note-result-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .note-result {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 0.6rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-float);
        background: var(--color-button-bg);
        color: inherit;
        text-align: left;
        cursor: pointer;
    }

    .note-result:hover {
        background: var(--color-button-bg-hover);
        border-color: var(--color-border-hover);
    }

    .note-result.selected {
        background: var(--color-editor-link-bg);
        border-color: var(--color-accent);
    }

    .note-result-thumbnail-frame {
        width: 4.5rem;
        aspect-ratio: var(--note-preview-aspect-ratio);
        flex: 0 0 auto;
        border-radius: 0.75rem;
        overflow: hidden;
        border: 1px solid var(--color-border);
        background: var(--color-bg-top);
    }

    .note-result-thumbnail-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        background: var(--color-bg-top);
    }

    .note-result-thumbnail-placeholder {
        width: 100%;
        height: 100%;
        background: linear-gradient(
            135deg,
            var(--color-surface),
            var(--color-button-bg)
        );
    }

    .note-result-text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }

    .note-result-title {
        font-size: 0.95rem;
        font-weight: 600;
        line-height: 1.35;
        color: var(--color-title);
        word-break: break-word;
    }

    .note-result-date {
        font-size: 0.78rem;
        color: var(--color-text-muted);
    }

    .selected-note {
        padding: 0.5rem 0.65rem;
        border-radius: var(--radius-button);
        background: var(--color-editor-link-bg);
        color: var(--color-accent);
        font-size: 0.82rem;
        font-weight: 600;
    }

    .status-text {
        margin: 0;
        font-size: 0.82rem;
        color: var(--color-text-muted);
    }

    .status-text.error {
        color: var(--color-danger, #b91c1c);
    }

    .link-dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 0.85rem 1rem 1rem;
        border-top: 1px solid var(--color-border);
    }

    .primary-button,
    .danger-button {
        height: 2.15rem;
        padding: 0.45rem 0.8rem;
        border-radius: var(--radius-button);
        border: 1px solid var(--color-border);
        cursor: pointer;
    }

    .primary-button {
        background: var(--color-accent);
        border-color: var(--color-accent);
        color: white;
    }

    .primary-button:hover {
        background: var(--color-button-bg-hover);
        color: var(--color-accent);
    }

    .primary-button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }

    .danger-button {
        background: var(--color-button-bg);
        color: var(--color-accent);
        border-color: var(--color-border);
    }

    .danger-button:hover {
        background: var(--color-editor-link-bg);
    }

    .create-note-link-button {
        width: 100%;
        height: auto;
        justify-content: flex-start;
        gap: 0.45rem;
        padding: 0.65rem 0.75rem;
        border: 1px dashed var(--color-border);
        border-radius: var(--radius-button);
        background: var(--color-editor-link-bg);
        color: var(--color-accent);
        font-weight: 650;
        cursor: pointer;
    }

    .create-note-link-button:hover {
        background: var(--color-button-bg-hover);
        border-color: var(--color-accent);
    }

    .create-note-link-icon {
        font-size: 1rem;
        line-height: 1;
    }
</style>

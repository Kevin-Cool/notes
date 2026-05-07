<script lang="ts">
    import { tick } from "svelte";
    import { goto } from "$app/navigation";
    import type { NoteRecord } from "$lib/types/note";
    import {
        getAllNotes,
        getNotePreviewFilePath,
    } from "$lib/services/note-service";
    import { convertFileSrc } from "@tauri-apps/api/core";

    let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

    let searchValue: string = $state("");
    let notes: NoteRecord[] = $state([]);
    let previewUrls: Record<string, string> = $state({});
    let isLoading: boolean = $state(false);
    let errorMessage: string | null = $state(null);
    let searchInputElement: HTMLInputElement | null = $state(null);
    let backdropPointerStartedOnBackdrop: boolean = $state(false);

    let hasLoadedForCurrentOpen: boolean = false;

    const normalizedSearchValue: string = $derived(
        normalizeSearchValue(searchValue),
    );

    const sortedNotes: NoteRecord[] = $derived(
        [...notes].sort(
            (a: NoteRecord, b: NoteRecord): number =>
                new Date(b.last_updated_at).getTime() -
                new Date(a.last_updated_at).getTime(),
        ),
    );

    const filteredNotes: NoteRecord[] = $derived(
        normalizedSearchValue.length === 0
            ? []
            : sortedNotes.filter((note: NoteRecord): boolean => {
                  const searchableText: string = `${note.name} ${note.content}`
                      .replace(/\s+/g, " ")
                      .toLocaleLowerCase();

                  return searchableText.includes(normalizedSearchValue);
              }),
    );

    function normalizeSearchValue(value: string): string {
        return value.trim().toLocaleLowerCase();
    }

    function close(): void {
        isOpen = false;
        searchValue = "";
        errorMessage = null;
        hasLoadedForCurrentOpen = false;
    }

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
                    note.last_updated_at,
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

    async function loadOverlay(): Promise<void> {
        try {
            isLoading = true;
            errorMessage = null;

            const loadedNotes: NoteRecord[] = await getAllNotes();
            notes = loadedNotes;

            await loadPreviewUrls(loadedNotes);

            await tick();
            searchInputElement?.focus();
        } catch (error: unknown) {
            errorMessage =
                error instanceof Error ? error.message : "Failed to load notes";
        } finally {
            isLoading = false;
        }
    }

    async function openNote(noteId: string): Promise<void> {
        close();
        await goto(`/note/${noteId}`);
    }

    $effect((): void => {
        if (!isOpen) {
            return;
        }

        if (hasLoadedForCurrentOpen) {
            return;
        }

        hasLoadedForCurrentOpen = true;
        void loadOverlay();
    });
</script>

{#if isOpen}
    <div
        class="dialog-backdrop"
        onmousedown={(event: MouseEvent): void => {
            backdropPointerStartedOnBackdrop =
                event.target === event.currentTarget;
        }}
        onclick={(event: MouseEvent): void => {
            const endedOnBackdrop: boolean =
                event.target === event.currentTarget;

            if (backdropPointerStartedOnBackdrop && endedOnBackdrop) {
                close();
            }

            backdropPointerStartedOnBackdrop = false;
        }}
        onkeydown={(event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                event.preventDefault();
                close();
            }
        }}
        tabindex="0"
        role="button"
    >
        <div
            class="search-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Search notes"
            tabindex="-1"
        >
            <div class="search-overlay-header">
                <input
                    bind:this={searchInputElement}
                    bind:value={searchValue}
                    class="search-overlay-input"
                    type="text"
                    placeholder="Search notes..."
                    aria-label="Search notes"
                    onkeydown={(event: KeyboardEvent): void => {
                        if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            close();
                        }

                        if (event.key === "Enter" && filteredNotes.length > 0) {
                            event.preventDefault();
                            void openNote(filteredNotes[0].id);
                        }
                    }}
                />
            </div>

            <div class="search-overlay-body">
                {#if isLoading}
                    <p class="status-text">Loading notes...</p>
                {:else if errorMessage}
                    <p class="status-text error">{errorMessage}</p>
                {:else if normalizedSearchValue.length === 0}
                    <p class="status-text">Start typing to search notes.</p>
                {:else if filteredNotes.length === 0}
                    <p class="status-text">No notes match your search.</p>
                {:else}
                    <div class="search-results-list">
                        {#each filteredNotes as note (note.id)}
                            <button
                                type="button"
                                class="search-result-item"
                                onclick={() => void openNote(note.id)}
                            >
                                <div class="search-result-thumbnail-frame">
                                    {#if previewUrls[note.id]}
                                        <img
                                            class="search-result-thumbnail-image"
                                            src={previewUrls[note.id]}
                                            alt={`Preview of ${note.name}`}
                                            loading="lazy"
                                        />
                                    {:else}
                                        <div
                                            class="search-result-thumbnail-placeholder"
                                        ></div>
                                    {/if}
                                </div>

                                <div class="search-result-text">
                                    <div class="search-result-title">
                                        {note.name}
                                    </div>
                                    <div class="search-result-meta">
                                        {new Date(
                                            note.last_updated_at,
                                        ).toLocaleString()}
                                    </div>
                                </div>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .search-overlay {
        width: min(42rem, 100%);
        max-height: min(75vh, 48rem);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-float);
        background: var(--color-surface);
        box-shadow: var(--shadow-float);
        backdrop-filter: blur(var(--blur-surface));
        -webkit-backdrop-filter: blur(var(--blur-surface));
    }

    .search-overlay-header {
        padding: 1rem;
        border-bottom: 1px solid var(--color-border);
    }

    .search-overlay-input {
        width: 100%;
        padding: 0.85rem 1rem;
        font-size: 1rem;
        line-height: 1.5;
        border: 0.0625rem solid var(--color-border);
        border-radius: var(--radius-float);
        background: var(--color-surface);
        color: var(--color-text-strong);
        box-sizing: border-box;
        box-shadow: var(--shadow-soft);
    }

    .search-overlay-input:focus {
        outline: none;
        border-color: var(--color-accent);
        background: var(--color-surface-strong);
        box-shadow:
            0 0 0 0.125rem
                color-mix(in srgb, var(--color-accent) 20%, transparent),
            var(--shadow-soft-hover);
    }

    .search-overlay-body {
        padding: 0.75rem;
        overflow-y: auto;
        min-height: 8rem;
    }

    .search-results-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .search-result-item {
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

    .search-result-item:hover {
        background: var(--color-button-bg-hover);
        border-color: var(--color-border-hover);
    }

    .search-result-thumbnail-frame {
        width: 4.5rem;
        aspect-ratio: var(--note-preview-aspect-ratio);
        flex: 0 0 auto;
        border-radius: 0.75rem;
        overflow: hidden;
        border: 1px solid var(--color-border);
        background: var(--color-bg-top);
    }

    .search-result-thumbnail-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        background: var(--color-bg-top);
    }

    .search-result-thumbnail-placeholder {
        width: 100%;
        height: 100%;
        background: linear-gradient(
            135deg,
            var(--color-surface),
            var(--color-button-bg)
        );
    }

    .search-result-text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }

    .search-result-title {
        font-size: 0.95rem;
        font-weight: 600;
        line-height: 1.35;
        color: var(--color-title);
        word-break: break-word;
    }

    .search-result-meta {
        font-size: 0.78rem;
        color: var(--color-text-muted);
    }
</style>

<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { revealItemInDir } from "@tauri-apps/plugin-opener";

    interface StorageUsageRecord {
        app_data_path: string;
        media_path: string;
        thumbnails_path: string;
        media_bytes: number;
        thumbnails_bytes: number;
        total_bytes: number;
    }

    let storageUsage: StorageUsageRecord | null = $state(null);
    let isLoading: boolean = $state(false);
    let errorMessage: string = $state("");

    function formatBytes(bytes: number): string {
        if (bytes <= 0) {
            return "0 B";
        }

        const units: string[] = ["B", "KB", "MB", "GB", "TB"];
        const unitIndex: number = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            units.length - 1,
        );

        const value: number = bytes / Math.pow(1024, unitIndex);

        return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    }

    async function loadStorageUsage(): Promise<void> {
        isLoading = true;
        errorMessage = "";

        try {
            storageUsage =
                await invoke<StorageUsageRecord>("get_storage_usage");
        } catch (error: unknown) {
            errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to load storage usage.";
        } finally {
            isLoading = false;
        }
    }

    async function openStorageFolder(): Promise<void> {
        if (!storageUsage) {
            return;
        }

        try {
            await revealItemInDir(storageUsage.media_path);
        } catch (error: unknown) {
            console.error("failed to open storage folder:", error);

            errorMessage =
                error instanceof Error ? error.message : String(error);
        }
    }

    $effect((): void => {
        void loadStorageUsage();
    });
</script>

<div class="settings-card storage-card">
    <div class="settings-card-header">
        <h2>Storage</h2>
        <p>Local space used by media files and note thumbnails.</p>
    </div>

    <div class="storage-content">
        {#if isLoading && !storageUsage}
            <p class="status-text">Calculating storage...</p>
        {:else if storageUsage}
            <div class="storage-summary">
                <strong>{formatBytes(storageUsage.total_bytes)}</strong>
                <span>Total local storage used</span>
            </div>

            <div class="storage-breakdown">
                <div class="storage-row">
                    <span>Media</span>
                    <strong>{formatBytes(storageUsage.media_bytes)}</strong>
                </div>

                <div class="storage-row">
                    <span>Thumbnails</span>
                    <strong>{formatBytes(storageUsage.thumbnails_bytes)}</strong
                    >
                </div>
            </div>

            <div class="storage-actions">
                <button
                    type="button"
                    class="secondary-button"
                    onclick={() => void loadStorageUsage()}
                    disabled={isLoading}
                >
                    {isLoading ? "Refreshing..." : "Refresh"}
                </button>

                <button
                    type="button"
                    class="storage-button"
                    onclick={() => void openStorageFolder()}
                >
                    Open folder
                </button>
            </div>
        {/if}

        {#if errorMessage}
            <p class="setting-error">{errorMessage}</p>
        {/if}
    </div>
</div>

<style>
    .storage-content {
        padding: 1rem 1.1rem;
        display: grid;
        gap: 1rem;
    }

    .storage-summary {
        display: grid;
        gap: 0.25rem;
    }

    .storage-summary strong {
        color: var(--color-title);
        font-size: 1.4rem;
    }

    .storage-summary span,
    .status-text {
        color: var(--color-text-muted);
        font-size: 0.9rem;
    }

    .storage-breakdown {
        display: grid;
        gap: 0.5rem;
    }

    .storage-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.65rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-button);
        background: var(--color-button-bg);
    }

    .storage-row span {
        color: var(--color-text-muted);
    }

    .storage-row strong {
        color: var(--color-text-strong);
    }

    .storage-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
    }

    .secondary-button,
    .storage-button {
        border-radius: var(--radius-button);
        padding: 0.55rem 0.8rem;
        font-family: inherit;
        font-weight: 700;
        cursor: pointer;
        box-shadow: var(--shadow-soft);
    }

    .secondary-button {
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text);
    }

    .storage-button {
        border: 0;
        background: var(--color-accent);
        color: white;
    }

    .secondary-button:disabled,
    .storage-button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
    }

    .setting-error {
        margin: 0;
        color: var(--color-warning);
        font-size: 0.85rem;
    }

    @media (max-width: 42rem) {
        .storage-actions {
            flex-direction: column;
        }
    }
</style>

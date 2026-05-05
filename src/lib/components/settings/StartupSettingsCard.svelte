<script lang="ts">
    import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

    let isAutostartEnabled: boolean = $state(false);
    let isSavingAutostart: boolean = $state(false);
    let errorMessage: string = $state("");

    async function loadAutostartState(): Promise<void> {
        try {
            errorMessage = "";
            isAutostartEnabled = await isEnabled();
        } catch (error: unknown) {
            errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to read startup setting.";
        }
    }

    async function toggleAutostart(): Promise<void> {
        isSavingAutostart = true;
        errorMessage = "";

        try {
            if (isAutostartEnabled) {
                await disable();
                isAutostartEnabled = false;
            } else {
                await enable();
                isAutostartEnabled = true;
            }
        } catch (error: unknown) {
            errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to update startup setting.";

            await loadAutostartState();
        } finally {
            isSavingAutostart = false;
        }
    }

    $effect((): void => {
        void loadAutostartState();
    });
</script>

<div class="settings-card startup-card">
    <div class="settings-card-header">
        <h2>Startup</h2>
        <p>Choose whether Notes starts automatically with your computer.</p>
    </div>

    <div class="startup-content">
        <div class="settings-card-info">
            <strong>
                {isAutostartEnabled
                    ? "Startup is enabled"
                    : "Startup is disabled"}
            </strong>

            <span>
                {isAutostartEnabled
                    ? "Notes is registered as a startup app."
                    : "Notes will not start automatically."}
            </span>

            {#if errorMessage}
                <span class="setting-error">{errorMessage}</span>
            {/if}
        </div>

        <button
            type="button"
            class="startup-button"
            onclick={() => void toggleAutostart()}
            disabled={isSavingAutostart}
        >
            {#if isSavingAutostart}
                Saving...
            {:else if isAutostartEnabled}
                Disable startup
            {:else}
                Enable startup
            {/if}
        </button>
    </div>
</div>

<style>
    .startup-content {
        padding: 1rem 1.1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
    }

    .settings-card-info {
        display: grid;
        gap: 0.25rem;
    }

    .settings-card-info strong {
        color: var(--color-title);
    }

    .settings-card-info span {
        color: var(--color-text-muted);
        font-size: 0.9rem;
    }

    .setting-error {
        color: var(--color-warning) !important;
    }

    .startup-button {
        border: 0;
        border-radius: var(--radius-button);
        background: var(--color-accent);
        color: white;
        cursor: pointer;
        padding: 0.55rem 0.8rem;
        font-family: inherit;
        font-weight: 700;
        box-shadow: var(--shadow-soft);
        white-space: nowrap;
    }

    .startup-button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
    }

    @media (max-width: 42rem) {
        .startup-content {
            align-items: stretch;
            flex-direction: column;
        }
    }
</style>

<script lang="ts">
    import {
        dismissAutostartPrompt,
        enableAutostart,
        hasDismissedAutostartPrompt,
        isAutostartRegistered,
    } from "$lib/services/settings-service";

    let isOpen: boolean = $state(false);
    let isSubmitting: boolean = $state(false);
    let errorMessage: string = $state("");

    async function checkStartupSettings(): Promise<void> {
        try {
            const isRegistered: boolean = await isAutostartRegistered();

            if (isRegistered) {
                return;
            }

            const hasDismissedPrompt: boolean =
                await hasDismissedAutostartPrompt();

            if (hasDismissedPrompt) {
                return;
            }

            isOpen = true;
        } catch (error: unknown) {
            console.error("failed to check startup settings:", error);
        }
    }

    async function handleEnableStartup(): Promise<void> {
        isSubmitting = true;
        errorMessage = "";

        try {
            await enableAutostart();
            await dismissAutostartPrompt();

            isOpen = false;
        } catch (error: unknown) {
            errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to enable startup.";

            console.error("failed to enable autostart:", error);
        } finally {
            isSubmitting = false;
        }
    }

    async function handleSkip(): Promise<void> {
        isSubmitting = true;
        errorMessage = "";

        try {
            await dismissAutostartPrompt();
            isOpen = false;
        } catch (error: unknown) {
            errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to save setting.";

            console.error("failed to dismiss autostart prompt:", error);
        } finally {
            isSubmitting = false;
        }
    }

    function handleBackdropClick(event: MouseEvent): void {
        if (event.target !== event.currentTarget) {
            return;
        }

        void handleSkip();
    }

    function handleGlobalKeydown(event: KeyboardEvent): void {
        if (!isOpen) {
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            void handleSkip();
        }
    }

    $effect((): (() => void) => {
        window.addEventListener("keydown", handleGlobalKeydown);

        return (): void => {
            window.removeEventListener("keydown", handleGlobalKeydown);
        };
    });

    $effect((): void => {
        void checkStartupSettings();
    });
</script>

{#if isOpen}
    <div
        class="dialog-backdrop"
        role="presentation"
        onclick={handleBackdropClick}
    >
        <div
            class="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="startup-settings-dialog-title"
        >
            <h2 id="startup-settings-dialog-title" class="dialog-title">
                Start Notes with your computer?
            </h2>

            <p class="dialog-description">
                Notes can open automatically when your computer starts, so it is
                ready when you need it.
            </p>

            {#if errorMessage}
                <p class="error-message">{errorMessage}</p>
            {/if}

            <div class="dialog-actions">
                <button
                    type="button"
                    class="secondary-button"
                    onclick={() => void handleSkip()}
                    disabled={isSubmitting}
                >
                    Not now
                </button>

                <button
                    type="button"
                    class="submit-button"
                    onclick={() => void handleEnableStartup()}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Saving..." : "Enable startup"}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .dialog {
        width: min(100%, 32rem);
        max-width: 100%;
        border: 1px solid var(--color-border);
        border-radius: 1rem;
        background: var(--color-surface);
        box-shadow: var(--shadow-soft-hover);
        padding: 1rem;
        box-sizing: border-box;
    }

    .dialog-title {
        margin: 0 0 0.75rem;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-title);
    }

    .dialog-description {
        margin: 0;
        color: var(--color-text-muted);
        line-height: 1.5;
    }

    .error-message {
        margin: 0.9rem 0 0;
        font-size: 0.85rem;
        color: var(--color-warning);
    }

    .dialog-actions {
        margin-top: 1rem;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 0.75rem;
    }

    .secondary-button,
    .submit-button {
        border-radius: 0.75rem;
        padding: 0.7rem 1rem;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
    }

    .secondary-button {
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text);
    }

    .secondary-button:hover {
        border-color: var(--color-border-hover);
        background: var(--color-button-bg-hover);
    }

    .submit-button {
        border: 0;
        background: var(--color-accent);
        color: white;
    }

    .secondary-button:disabled,
    .submit-button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
    }
</style>
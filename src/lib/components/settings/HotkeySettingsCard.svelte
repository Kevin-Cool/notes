<script lang="ts">
    type HotkeyInfo = {
        keys: string[];
        action: string;
        scope: string;
    };

    const hotkeys: HotkeyInfo[] = [
        {
            keys: ["Double-tap Ctrl"],
            action: "Toggle the custom window bar",
            scope: "App window",
        },
        {
            keys: ["Ctrl / Cmd + Alt + N"],
            action: "Toggle the custom window bar",
            scope: "Global",
        },
        {
            keys: ["Ctrl / Cmd + Shift + 1", "Ctrl / Cmd + Alt + Numpad 1"],
            action: "Show or minimize the app",
            scope: "Global",
        },
        {
            keys: ["Ctrl / Cmd + Shift + 2", "Ctrl / Cmd + Alt + Numpad 2"],
            action: "Snap the app to the right-most monitor",
            scope: "Global",
        },
    ];
</script>

<div class="settings-card hotkey-card">
    <div class="settings-card-header">
        <h2>Hotkeys</h2>
        <p>Shortcuts currently registered by the app.</p>
    </div>

    <div class="hotkey-list">
        {#each hotkeys as hotkey}
            <div class="hotkey-row">
                <div class="hotkey-main">
                    <div class="hotkey-keys">
                        {#each hotkey.keys as key}
                            <kbd>{key}</kbd>
                        {/each}
                    </div>
                    <span>{hotkey.scope}</span>
                </div>

                <p>{hotkey.action}</p>
            </div>
        {/each}
    </div>
</div>

<style>
    .hotkey-list {
        display: flex;
        flex-direction: column;
    }

    .hotkey-row {
        display: grid;
        grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr);
        gap: 1rem;
        align-items: center;
        padding: 0.9rem 1.1rem;
        border-bottom: 1px solid
            color-mix(in srgb, var(--color-border) 65%, transparent);
    }

    .hotkey-row:last-child {
        border-bottom: none;
    }

    .hotkey-main {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    kbd {
        width: fit-content;
        padding: 0.35rem 0.55rem;
        border: 1px solid var(--color-border);
        border-radius: 0.55rem;
        background: var(--color-button-bg);
        color: var(--color-accent);
        font-family: inherit;
        font-size: 0.85rem;
        font-weight: 700;
        box-shadow: var(--shadow-soft);
    }

    .hotkey-main span {
        font-size: 0.78rem;
        color: var(--color-text-muted);
    }

    .hotkey-keys {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .hotkey-row p {
        margin: 0;
        color: var(--color-text-strong);
        line-height: 1.45;
    }

    @media (max-width: 42rem) {
        .hotkey-row {
            grid-template-columns: 1fr;
            gap: 0.6rem;
        }
    }
</style>

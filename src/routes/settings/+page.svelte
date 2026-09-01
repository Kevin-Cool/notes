<script lang="ts">
    import HotkeySettingsCard from "$lib/components/settings/HotkeySettingsCard.svelte";
    import StartupSettingsCard from "$lib/components/settings/StartupSettingsCard.svelte";
    import StorageSettingsCard from "$lib/components/settings/StorageSettingsCard.svelte";
    import ThemeSettingsCard from "$lib/components/settings/ThemeSettingsCard.svelte";
    import { isDesktopPlatform } from "$lib/device/platform";
    import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

    const appWindow = getCurrentWebviewWindow();

    async function closeProgram(): Promise<void> {
        await appWindow.close();
    }
</script>

<section class="settings-page">
    <header class="settings-header">
        <h1>Settings</h1>
    </header>

    <HotkeySettingsCard />

    <ThemeSettingsCard />

    <StartupSettingsCard />

    <StorageSettingsCard />

    <div class="settings-card danger-card">
        <div class="settings-card-header">
            <h2>Program</h2>
            <p>Exit the app completely.</p>
        </div>

        <div class="danger-content">
            <button type="button" class="danger-button" onclick={closeProgram}>
                Close program
            </button>
        </div>
    </div>

    
    {#if !isDesktopPlatform}
    <div class="fake-div">   </div>
    {/if}

</section>

<style>
    .settings-page {
        min-height: 100%;
        box-sizing: border-box;
        padding: 2rem;

        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;

        color: var(--color-text-strong);
    }
    
    .settings-page :global(.settings-card) {
        width: 100%;
    }

    .danger-card {
        margin-top: 1rem;
    }

    .danger-content {
        padding: 1rem 1.1rem;
    }

    .danger-button {
        border: 1px solid var(--color-task-red);
        border-radius: var(--radius-button);
        background: var(--color-button-bg);
        color: var(--color-task-red);
        cursor: pointer;
        padding: 0.55rem 0.8rem;
        font-family: inherit;
        font-weight: 700;
        box-shadow: var(--shadow-soft);
        transition:
            background 140ms ease,
            transform 140ms ease,
            box-shadow 140ms ease;
    }

    .danger-button:hover {
        background: color-mix(
            in srgb,
            var(--color-task-red) 10%,
            var(--color-button-bg)
        );
        box-shadow: var(--shadow-soft-hover);
        transform: translateY(-1px);
    }

    .danger-button:active {
        transform: scale(0.97);
    }

    @media (max-width: 42rem) {
        .settings-page {
            padding: 1rem;
        }
    }

    .fake-div{
        min-height:1rem
    }
</style>

<script lang="ts">
    import { onMount } from "svelte";
    import { uiState } from "$lib/state/ui.svelte";
    import TitleBar from "./TitleBar.svelte";
    import SideNav from "./SideNav.svelte";
    import WindowDragHandle from "./WindowDragHandle.svelte";
    import { registerGlobalShortcuts } from "$lib/tauri/global-shortcuts";
    import { registerDoubleCtrlTap } from "$lib/utils/register-double-ctrl-tap";
    import { isMobilePlatform } from "$lib/device/platform";
    import MobileNav from "./MobileNav.svelte";

    let { children } = $props();

    onMount((): (() => void) => {
        const cleanupShortcuts: () => void = registerGlobalShortcuts();
        const cleanupDoubleCtrlTap: () => void = registerDoubleCtrlTap();

        return (): void => {
            cleanupShortcuts();
            cleanupDoubleCtrlTap();
        };
    });
</script>

<div class="window-shell">
    {#if isMobilePlatform}
        <div class="mobile-layout">
            <main class="content mobile-content">
                <div class="content-inner">
                    {@render children()}
                </div>
            </main>

            <div class="mobile-nav">
                <MobileNav />
            </div>
        </div>
    {:else if uiState.showCustomBar}
        <TitleBar />

        <div class="app-layout">
            <SideNav />

            <main class="content with-bar">
                <div class="content-inner">
                    {@render children()}
                </div>
            </main>
        </div>
    {:else}
        <WindowDragHandle />

        <main class="content">
            <div class="content-inner">
                {@render children()}
            </div>
        </main>
    {/if}
</div>

<style>
    .window-shell {
        height: 100dvh;
        display: flex;
        flex-direction: column;
        background: linear-gradient(
            180deg,
            var(--color-surface) 0%,
            var(--color-surface-strong) 100%
        );
        backdrop-filter: blur(var(--blur-surface));
        overflow: hidden;
    }

    .app-layout {
        display: grid;
        grid-template-columns: var(--side-nav-width) minmax(0, 1fr);
        height: 100%;
        overflow: hidden;
    }

    .content {
        min-width: 0;
        min-height: 0;
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        color: var(--color-text-strong);
    }

    .content.with-bar {
        height: calc(100% - var(--titlebar-height));
        margin-top: var(--titlebar-height);
    }

    .content-inner {
        height: 100%;
        min-height: 0;
        box-sizing: border-box;
    }

    .content :global(h1) {
        margin: 0 0 10px;
        font-size: 2rem;
        color: var(--color-heading);
    }

    .content :global(p) {
        margin: 0 0 8px;
        color: var(--color-text-muted);
        line-height: 1.5;
    }

    .mobile-layout {
        --mobile-nav-height: 4rem;

        display: grid;
        grid-template-rows: minmax(0, 1fr) auto;

        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
    }

    .mobile-content {
        height: auto;
        min-height: 0;

        overflow-y: auto;
        overflow-x: hidden;

        padding-top: env(safe-area-inset-top);

        box-sizing: border-box;
    }

    .mobile-nav {
        position: static;

        height: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom));

        padding-bottom: env(safe-area-inset-bottom);
        box-sizing: border-box;

        background: linear-gradient(var(--color-nav-bg), var(--color-nav-bg)),
            var(--color-surface-strong);

        border-top: 1px solid var(--color-border);
        z-index: 100;
    }
</style>

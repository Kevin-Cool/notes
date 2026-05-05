<script lang="ts">
    import { onMount } from "svelte";
    import { uiState } from "$lib/state/ui.svelte";
    import TitleBar from "./TitleBar.svelte";
    import SideNav from "./SideNav.svelte";
    import WindowDragHandle from "./WindowDragHandle.svelte";
    import { registerGlobalShortcuts } from "$lib/tauri/global-shortcuts";
    import { registerDoubleCtrlTap } from "$lib/utils/register-double-ctrl-tap";

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
    {#if uiState.showCustomBar}
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
</style>

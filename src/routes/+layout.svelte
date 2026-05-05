<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import { uiState } from "$lib/state/ui.svelte";

	import "highlight.js/styles/atom-one-dark-reasonable.css";
	import SearchOverlay from "$lib/components/app-shell/SearchOverlay.svelte";
	import AppShell from "$lib/components/app-shell/AppShell.svelte";
	import "$lib/styles/app-theme.css";
    import StartupSettingsDialog from "$lib/components/StartupSettingsDialog.svelte";
    import { getSavedTheme, type ThemeName } from "$lib/services/settings-service";
    import { browser } from "$app/environment";

	let { children } = $props();
	
    function applyTheme(theme: ThemeName): void {
        document.documentElement.dataset.theme = theme;
    }

    $effect((): void => {
        if (!browser) {
            return;
        }

        void applySavedTheme();
    });

    async function applySavedTheme(): Promise<void> {
        const savedTheme: ThemeName | null = await getSavedTheme();

        if (savedTheme === null) {
            return;
        }

        applyTheme(savedTheme);
    }
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<AppShell>
	{@render children()}
</AppShell>

<SearchOverlay bind:isOpen={uiState.isSearchOverlayOpen} />

<StartupSettingsDialog />

<style>
</style>

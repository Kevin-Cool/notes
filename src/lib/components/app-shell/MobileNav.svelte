<script lang="ts">
    import { goto } from "$app/navigation";
    import { navItems, type NavItem } from "$lib/config/nav-items";
    import { uiState } from "$lib/state/ui.svelte";

    const mobileNavItems: NavItem[] = navItems.filter(
        (item: NavItem): boolean =>
            item.position === "main" ||
            item.position === "middle" 
    );

    function openSearchOverlay(): void {
        uiState.isSearchOverlayOpen = true;
    }

    async function handleNavClick(item: NavItem): Promise<void> {
        if (item.id === "new") {
            const noteId: string = crypto.randomUUID();
            await goto(`/note/${noteId}`);
            return;
        }

        if (item.id === "search") {
            const currentPath: string = window.location.pathname;

            if (currentPath === "/notes") {
                window.dispatchEvent(new CustomEvent("focus-notes-search"));
                return;
            }

            openSearchOverlay();
            return;
        }

        await goto(item.href);
    }
</script>

<nav class="mobile-nav-bar" aria-label="Primary navigation">
    {#each mobileNavItems as item (item.id)}
        <button
            type="button"
            class="mobile-nav-button"
            class:primary={item.id === "new"}
            title={item.label}
            aria-label={item.label}
            onclick={(): Promise<void> => handleNavClick(item)}
        >
            {#if item.icon.type === "text"}
                <span class="mobile-nav-icon-text" aria-hidden="true">
                    {item.icon.value}
                </span>
            {:else}
                <span
                    class="mobile-nav-icon-image"
                    style={`--icon-url: url("${item.icon.value}")`}
                    aria-hidden="true"
                ></span>
            {/if}

            <span class="mobile-nav-label">
                {item.label}
            </span>
        </button>
    {/each}
</nav>

<style>

.mobile-nav-bar {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));

    width: 100%;
    height: 100%;

    background: transparent;
    border: none;

    box-sizing: border-box;
}

    .mobile-nav-button {
        min-width: 0;
        height: 100%;

        padding: 0.4rem 0.2rem;

        border: none;
        border-radius: 0;

        background: transparent;
        color: var(--color-text-muted);

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        gap: 0.2rem;

        font: inherit;

        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
    }

    .mobile-nav-button:active {
        background: var(--color-button-bg-hover);
    }

    .mobile-nav-button.primary {
        color: var(--color-accent);
    }

    .mobile-nav-icon-text {
        font-size: 1.25rem;
        line-height: 1;
    }

    .mobile-nav-icon-image {
        width: 1.25rem;
        height: 1.25rem;

        display: block;

        background-color: currentColor;

        -webkit-mask-image: var(--icon-url);
        mask-image: var(--icon-url);

        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;

        -webkit-mask-position: center;
        mask-position: center;

        -webkit-mask-size: contain;
        mask-size: contain;
    }

    .mobile-nav-label {
        max-width: 100%;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        font-size: 0.7rem;
        line-height: 1;
    }
</style>

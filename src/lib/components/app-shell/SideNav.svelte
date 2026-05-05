<script lang="ts">
    import { goto } from "$app/navigation";
    import { navItems, type NavItem } from "$lib/config/nav-items";
    import { uiState } from "$lib/state/ui.svelte";

    const mainNavItem: NavItem | undefined = navItems.find(
        (item: NavItem): boolean => item.position === "main",
    );

    const middleNavItems: NavItem[] = navItems.filter(
        (item: NavItem): boolean => item.position === "middle",
    );

    const bottomNavItem: NavItem | undefined = navItems.find(
        (item: NavItem): boolean => item.position === "bottom",
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

<nav
    class:with-bar={uiState.showCustomBar}
    class="side-nav"
    aria-label="Primary navigation"
>
    <div class="side-nav-top">
        {#if mainNavItem}
            <button
                type="button"
                class="nav-icon-button nav-icon-button-main"
                title={mainNavItem.label}
                aria-label={mainNavItem.label}
                onclick={(): Promise<void> => handleNavClick(mainNavItem)}
            >
                {#if mainNavItem.icon.type === "text"}
                    <span class="nav-icon-text" aria-hidden="true"
                        >{mainNavItem.icon.value}</span
                    >
                {:else}
                    <span
                        class="nav-icon-image"
                        style={`--icon-url: url("${mainNavItem.icon.value}")`}
                        aria-hidden="true"
                    ></span>
                {/if}
            </button>
        {/if}

        <div class="side-nav-main-gap"></div>

        {#each middleNavItems as item (item.id)}
            <button
                type="button"
                class="nav-icon-button"
                title={item.label}
                aria-label={item.label}
                onclick={(): Promise<void> => handleNavClick(item)}
            >
                {#if item.icon.type === "text"}
                    <span class="nav-icon-text" aria-hidden="true"
                        >{item.icon.value}</span
                    >
                {:else}
                    <span
                        class="icon-image"
                        style={`--icon-url: url("${item.icon.value}")`}
                        aria-hidden="true"
                    ></span>
                {/if}
            </button>
        {/each}
    </div>

    <div class="side-nav-bottom">
        {#if bottomNavItem}
            <button
                type="button"
                class="nav-icon-button"
                title={bottomNavItem.label}
                aria-label={bottomNavItem.label}
                onclick={(): Promise<void> => handleNavClick(bottomNavItem)}
            >
                {#if bottomNavItem.icon.type === "text"}
                    <span class="nav-icon-text" aria-hidden="true"
                        >{bottomNavItem.icon.value}</span
                    >
                {:else}
                    <img
                        class="icon-image"
                        src={bottomNavItem.icon.value}
                        alt={bottomNavItem.icon.alt}
                    />
                {/if}
            </button>
        {/if}
    </div>
</nav>

<style>
    .side-nav {
        position: relative;
        z-index: 10;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: stretch;
        height: 100%;
        box-sizing: border-box;
        border-right: 1px solid var(--color-border);
        background: var(--color-nav-bg);
        backdrop-filter: blur(12px);
        overflow: hidden;
    }

    .side-nav.with-bar {
        height: calc(100% - var(--titlebar-height));
        margin-top: var(--titlebar-height);
    }

    .side-nav-top {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        width: 100%;
        gap: 0;
    }

    .side-nav-main-gap {
        height: 22px;
    }

    .side-nav-bottom {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
    }

    .nav-icon-button {
        width: 100%;
        aspect-ratio: 1 / 1;
        height: auto;

        border: none;
        border-radius: 0;
        background: var(--color-button-bg);
        color: var(--color-accent);
        cursor: pointer;

        display: flex;
        align-items: center;
        justify-content: center;

        box-shadow: inset 0 0 0 1px transparent;
        transition:
            background 140ms ease,
            box-shadow 140ms ease,
            color 140ms ease;
    }


    .nav-icon-button:hover {
        background: var(--color-button-bg-hover);
        border: none !important;
    }

    .side-nav-top > .nav-icon-button:not(.nav-icon-button-main):hover {
        box-shadow: inset 4px 0 0 var(--color-border-hover);
    }
    .nav-icon-button:active {
        transform: none;
    }

    .nav-icon-text {
        font-size: 18px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .nav-icon-button-main .nav-icon-text {
        font-size: 20px;
    }

    .nav-icon-image {
        width: 1.125rem;
        height: 1.125rem;
        display: block;
        object-fit: contain;
    }

    .nav-icon-button-main .nav-icon-image {
        width: 1.25rem;
        height: 1.25rem;
    }

    .nav-icon-button-main span {
        font-size: 20px;
    }
</style>

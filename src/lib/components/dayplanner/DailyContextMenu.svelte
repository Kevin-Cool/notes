<script lang="ts">
    import { tick } from "svelte";

    import type { DayplannerDaily } from "$lib/types/dayplanner/dayplanner-daily";
    import { uiState } from "$lib/state/ui.svelte";

    export type DailyContextMenuState =
        | {
              mode: "empty";
              x: number;
              y: number;
          }
        | {
              mode: "daily";
              x: number;
              y: number;
              daily: DayplannerDaily;
          };

    let {
        menu,
        onClose,
        onCreate,
        onEdit,
        onDelete,
        onChangeTarget,
    }: {
        menu: DailyContextMenuState | null;
        onClose: () => void;
        onCreate: () => void;
        onEdit: (daily: DayplannerDaily) => void;
        onDelete: (daily: DayplannerDaily) => void;
        onChangeTarget: (daily: DayplannerDaily, target: number) => void;
    } = $props();


    const viewportPaddingPx: number = 8;

    let menuElement: HTMLDivElement | null = $state(null);
    let menuLeftPx: number = $state(0);
    let menuTopPx: number = $state(0);

    function clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    async function updateMenuPosition(): Promise<void> {
        if (!menu) {
            return;
        }

        await tick();

        if (!menuElement) {
            return;
        }

        const menuRect: DOMRect = menuElement.getBoundingClientRect();
        const viewportWidth: number = window.innerWidth;
        const viewportHeight: number = window.innerHeight;

        const maxLeft: number = Math.max(
            viewportPaddingPx,
            viewportWidth - menuRect.width - viewportPaddingPx,
        );

        const maxTop: number = Math.max(
            viewportPaddingPx,
            viewportHeight - menuRect.height - viewportPaddingPx,
        );

        menuLeftPx = clamp(menu.x, viewportPaddingPx, maxLeft);
        menuTopPx = clamp(menu.y, viewportPaddingPx, maxTop);
    }

    function handleWindowResize(): void {
        if (!menu) {
            return;
        }

        void updateMenuPosition();
    }

    function handleTargetInput(event: Event, daily: DayplannerDaily): void {
        const input: HTMLInputElement = event.currentTarget as HTMLInputElement;
        const target: number = Number(input.value);

        onChangeTarget(daily, target);
    }

    $effect((): void => {
        if (!menu) {
            return;
        }

        void updateMenuPosition();
    });

    const menuKey: string = "dayplanner-dailies";
    let wasOpen: boolean = $state(false);

    $effect((): void => {
        const isOpen: boolean = menu !== null;

        if (isOpen && !wasOpen) {
            uiState.activeContextMenuKey = menuKey;
            wasOpen = true;
            return;
        }

        if (!isOpen) {
            wasOpen = false;

            if (uiState.activeContextMenuKey === menuKey) {
                uiState.activeContextMenuKey = null;
            }

            return;
        }

        if (isOpen && uiState.activeContextMenuKey !== menuKey) {
            onClose();
        }
    });
</script>

<svelte:window
    onclick={() => {
        if (menu) {
            onClose();
        }
    }}
    onkeydown={(event: KeyboardEvent): void => {
        if (event.key === "Escape" && menu) {
            onClose();
        }
    }}
    onresize={handleWindowResize}
/>

{#if menu}
    <div
        bind:this={menuElement}
        class="context-menu"
        style={`left: ${menuLeftPx}px; top: ${menuTopPx}px;`}
        onclick={(event: MouseEvent): void => event.stopPropagation()}
        onkeydown={(event: KeyboardEvent): void => {
            if (event.key === "Enter") {
                event.preventDefault();

                if (menu.mode === "empty") {
                    onCreate();
                } else {
                    onEdit(menu.daily);
                }
            }
        }}
        role="menu"
        tabindex="-1"
    >
        {#if menu.mode === "empty"}
            <button type="button" class="context-menu-item" onclick={onCreate}>
                Create
            </button>
        {:else}
            <button
                type="button"
                class="context-menu-item"
                onclick={() => onEdit(menu.daily)}
            >
                Edit
            </button>

            <button
                type="button"
                class="context-menu-item context-menu-item-danger"
                onclick={() => onDelete(menu.daily)}
            >
                Delete
            </button>

            <div class="context-menu-separator"></div>

            <div class="context-menu-section-label">
                Target: {menu.daily.target}
            </div>

            <div class="target-slider-row">
                <span>1</span>

                <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={menu.daily.target}
                    oninput={(event: Event): void =>
                        handleTargetInput(event, menu.daily)}
                    aria-label="Daily target"
                />

                <span>10</span>
            </div>
        {/if}
    </div>
{/if}

<style>
    .context-menu {
        position: fixed;
        z-index: 2001;
        min-width: 12rem;
        padding: 0.375rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-float);
        background: var(--color-surface);
        box-shadow: var(--shadow-float);
    }

    .context-menu-item {
        width: 100%;
        padding: 0.65rem 0.75rem;
        border: none;
        background: transparent;
        text-align: left;
        border-radius: var(--radius-button);
        cursor: pointer;
        color: var(--color-text);
    }

    .context-menu-item:hover {
        background: var(--color-button-bg-hover);
    }

    .context-menu-separator {
        height: 1px;
        margin: 0.35rem 0;
        background: var(--color-border);
    }

    .context-menu-section-label {
        padding: 0.4rem 0.5rem 0.5rem;
        font-size: 0.8rem;
        color: var(--color-text-muted);
    }

    .target-slider-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem 0.5rem 0.55rem;
        color: var(--color-text-muted);
        font-size: 0.8rem;
    }

    .target-slider-row input {
        width: 100%;
    }

    .context-menu-item-danger {
        color: var(--color-danger, var(--color-task-red));
    }

    .context-menu-item-danger:hover {
        background: color-mix(
            in srgb,
            var(--color-danger, var(--color-task-red)) 12%,
            transparent 88%
        );
    }
</style>

<script lang="ts">
    import { tick } from "svelte";

    import type { DayplannerTodo } from "$lib/types/dayplanner/dayplanner-todo";
    import type { TodoContextMenuState } from "$lib/types/dayplanner/todo-context-menu";
    import { TodoColor } from "$lib/types/dayplanner/todo-color";
    import { uiState } from "$lib/state/ui.svelte";

    let {
        menu,
        onClose,
        onCreate,
        onEdit,
        onDelete,
        onChangeColor,
    }: {
        menu: TodoContextMenuState | null;
        onClose: () => void;
        onCreate: () => void;
        onEdit: (todo: DayplannerTodo) => void;
        onDelete: (todo: DayplannerTodo) => void;
        onChangeColor: (todo: DayplannerTodo, color: TodoColor) => void;
    } = $props();

    const todoColors: TodoColor[] = [
        TodoColor.Primary,
        TodoColor.Red,
        TodoColor.Blue,
    ];

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

    $effect((): void => {
        if (!menu) {
            return;
        }

        void updateMenuPosition();
    });

    const menuKey: string = "dayplanner-todos";
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
                    onEdit(menu.todo);
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
                onclick={() => onEdit(menu.todo)}
            >
                Edit
            </button>

            <button
                type="button"
                class="context-menu-item context-menu-item-danger"
                onclick={() => onDelete(menu.todo)}
            >
                Delete
            </button>

            <div class="context-menu-separator"></div>

            <div class="context-menu-section-label">Change color</div>

            <div class="context-menu-color-grid">
                {#each todoColors as color (color)}
                    <button
                        type="button"
                        class={`context-menu-color-dot todo-color-${color}`}
                        onclick={() => onChangeColor(menu.todo, color)}
                        aria-label={`Set color ${color}`}
                        title={`Set color ${color}`}
                    ></button>
                {/each}
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

    .context-menu-color-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.4rem;
        padding: 0.25rem 0.4rem 0.4rem;
    }

    .context-menu-color-dot {
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 999px;
        border: 1px solid var(--todo-border);
        background: var(--todo-bg);
        cursor: pointer;
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

    .todo-color-1 {
        --todo-bg: var(--color-todo-primary-bg);
        --todo-border: var(--color-todo-primary-border);
        --todo-accent: var(--color-todo-primary-accent);
    }

    .todo-color-2 {
        --todo-bg: var(--color-todo-red-bg);
        --todo-border: var(--color-todo-red-border);
        --todo-accent: var(--color-todo-red-accent);
    }

    .todo-color-3 {
        --todo-bg: var(--color-todo-blue-bg);
        --todo-border: var(--color-todo-blue-border);
        --todo-accent: var(--color-todo-blue-accent);
    }
</style>

<script lang="ts">
    import { tick } from "svelte";
    import type { CalendarTask } from "$lib/types/tasks/calendar-task";
    import type { TaskColor } from "$lib/types/tasks/task-color";
    import type { TaskContextMenuState } from "$lib/types/tasks/task-context-menu";

    let {
        menu,
        onClose,
        onCreate,
        onEdit,
        onChangeColor,
    }: {
        menu: TaskContextMenuState | null;
        onClose: () => void;
        onCreate: () => void;
        onEdit: (task: CalendarTask) => void;
        onChangeColor: (task: CalendarTask, color: TaskColor) => void;
    } = $props();

    const taskColors: TaskColor[] = [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ] as TaskColor[];

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

    $effect((): void => {
        if (!menu) {
            return;
        }

        void updateMenuPosition();
    });

    function handleWindowResize(): void {
        if (!menu) {
            return;
        }

        void updateMenuPosition();
    }
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
                }
            }
        }}
        role="button"
        tabindex="0"
    >
        {#if menu.mode === "empty"}
            <button type="button" class="context-menu-item" onclick={onCreate}>
                Create
            </button>

            <div class="context-menu-separator"></div>
        {:else}
            <button
                type="button"
                class="context-menu-item"
                onclick={() => onEdit(menu.task)}
            >
                Edit
            </button>

            <div class="context-menu-separator"></div>

            <div class="context-menu-section-label">Change color</div>

            <div class="context-menu-color-grid">
                {#each taskColors as color (color)}
                    <button
                        type="button"
                        class={`context-menu-color-dot task-color-${color}`}
                        onclick={() => onChangeColor(menu.task, color)}
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
        grid-template-columns: repeat(6, 1fr);
        gap: 0.4rem;
        padding: 0.25rem 0.4rem 0.4rem;
    }

    .context-menu-color-dot {
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--task-accent) 35%, white 65%);
        background: var(--task-accent);
        cursor: pointer;
    }

    .task-color-1 {
        --task-accent: var(--color-task-primary);
    }

    .task-color-2 {
        --task-accent: var(--color-task-red);
    }

    .task-color-3 {
        --task-accent: var(--color-task-rose);
    }

    .task-color-4 {
        --task-accent: var(--color-task-blue);
    }

    .task-color-5 {
        --task-accent: var(--color-task-blue-light);
    }

    .task-color-6 {
        --task-accent: var(--color-task-green);
    }

    .task-color-7 {
        --task-accent: var(--color-task-green-light);
    }

    .task-color-8 {
        --task-accent: var(--color-task-yellow);
    }

    .task-color-9 {
        --task-accent: var(--color-task-orange);
    }

    .task-color-10 {
        --task-accent: var(--color-task-purple);
    }

    .task-color-11 {
        --task-accent: var(--color-task-lavender);
    }

    .task-color-12 {
        --task-accent: var(--color-task-gray);
    }

    .task-color-13 {
        --task-accent: var(--color-task-brown);
    }
</style>
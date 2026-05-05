<script lang="ts">
    import type { CalendarView } from "$lib/types/tasks/calendar-view";

    type Props = {
        currentView: CalendarView;
        viewingDate: Date;
        dateLabel: string;
        isDatePickerOpen: boolean;
        isViewDropdownOpen: boolean;
        showTodayButton: boolean;
        dateLabelElement: HTMLButtonElement | null;
        onToggleDatePicker: (event: MouseEvent) => void;
        onNavigatePrevious: (event: MouseEvent) => void;
        onNavigateNext: (event: MouseEvent) => void;
        onNavigateToday: (event: MouseEvent) => void;
        onToggleViewDropdown: (event: MouseEvent) => void;
        onSelectView: (view: CalendarView) => void;
        onCloseViewDropdown: () => void;
    };

    let {
        currentView,
        dateLabel,
        isDatePickerOpen,
        isViewDropdownOpen,
        showTodayButton,
        dateLabelElement = $bindable(),
        onToggleDatePicker,
        onNavigatePrevious,
        onNavigateNext,
        onNavigateToday,
        onToggleViewDropdown,
        onSelectView,
        onCloseViewDropdown
    }: Props = $props();

    const views: CalendarView[] = ["day", "week", "month"];
</script>

<div class="tasks-toolbar">
    <div class="tasks-toolbar-inner">
        <div class="tasks-toolbar-controls">
            <div class="tasks-toolbar-nav">
                <button
                    bind:this={dateLabelElement}
                    type="button"
                    class="tasks-date-label"
                    class:active={isDatePickerOpen}
                    onclick={onToggleDatePicker}
                >
                    {dateLabel}
                </button>

                <button
                    type="button"
                    class="toolbar-button"
                    onclick={onNavigatePrevious}
                >
                    ←
                </button>

                <button
                    type="button"
                    class="toolbar-button"
                    onclick={onNavigateNext}
                >
                    →
                </button>

                {#if showTodayButton}
                    <button
                        type="button"
                        class="toolbar-button today-button"
                        onclick={onNavigateToday}
                    >
                        Today
                    </button>
                {/if}
            </div>

            <div class="view-menu-wrap">
                <button
                    type="button"
                    class="toolbar-button view-button"
                    class:active={isViewDropdownOpen}
                    onclick={onToggleViewDropdown}
                >
                    {currentView}
                </button>

                {#if isViewDropdownOpen}
                    <div
                        class="view-dropdown"
                        role="menu"
                        tabindex="-1"
                        onclick={(event: MouseEvent): void =>
                            event.stopPropagation()}
                        onkeydown={(event: KeyboardEvent): void => {
                            event.stopPropagation();

                            if (event.key === "Escape") {
                                onCloseViewDropdown();
                            }
                        }}
                    >
                        {#each views as view}
                            <button
                                type="button"
                                class:active={currentView === view}
                                onclick={(): void => onSelectView(view)}
                            >
                                {view}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    .tasks-toolbar {
        position: sticky;
        top: 0;
        z-index: 100;
        display: flex;
        justify-content: center;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-surface);
        backdrop-filter: blur(var(--blur-bar));
        user-select: none;
    }

    .tasks-toolbar-inner {
        width: 100%;
        min-width: 0;
    }

    .tasks-toolbar-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        width: 100%;
        min-width: 0;
        position: relative;
    }

    .tasks-toolbar-nav {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        min-width: 0;
    }

    .tasks-date-label {
        border: 1px solid transparent;
        background: transparent;
        color: var(--color-text);
        white-space: nowrap;
        padding: 0.34rem 0.45rem;
        border-radius: var(--radius-button);
        font-size: 0.9rem;
        cursor: pointer;

        min-width: 8rem;
        text-align: left;
    }

    .tasks-date-label:hover {
        background: var(--color-button-bg-hover);
        border-color: var(--color-border);
    }

    .tasks-date-label.active {
        background: var(--color-editor-link-bg);
        color: var(--color-accent);
        border-color: var(--color-accent);
    }

    .toolbar-button {
        border: 1px solid var(--color-border);
        background: var(--color-button-bg);
        color: var(--color-text);
        padding: 0.34rem 0.55rem;
        min-width: 2rem;
        height: 2rem;
        border-radius: var(--radius-button);
        font-size: 0.82rem;
        line-height: 1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        transition:
            background 120ms ease,
            border-color 120ms ease,
            color 120ms ease,
            box-shadow 120ms ease,
            transform 120ms ease;
    }

    .toolbar-button:hover {
        background: var(--color-button-bg-hover);
        border-color: var(--color-border-hover);
        box-shadow: var(--shadow-soft);
    }

    .toolbar-button:focus-visible {
        outline: none;
        border-color: var(--color-accent);
        box-shadow: 0 0 0 2px var(--color-editor-link-bg);
    }

    .toolbar-button.active {
        background: var(--color-editor-link-bg);
        color: var(--color-accent);
        border-color: var(--color-accent);
        box-shadow: var(--shadow-soft);
    }

    .view-button {
        min-width: 4.5rem;
        text-transform: capitalize;
    }

    .view-menu-wrap {
        position: relative;
        margin-left: auto;
    }

    .view-dropdown {
        position: absolute;
        top: calc(100% + 0.4rem);
        right: 0;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 8rem;
        padding: 0.4rem;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-float);
        box-shadow: var(--shadow-float);
        backdrop-filter: blur(var(--blur-surface));
        z-index: 45;
    }

    .view-dropdown button {
        width: 100%;
        justify-content: flex-start;
        height: auto;
        padding: 0.55rem 0.7rem;
        font-size: 0.82rem;
        border: 1px solid var(--color-border);
        background: transparent;
        color: var(--color-text);
        border-radius: var(--radius-button);
        cursor: pointer;
        text-transform: capitalize;
    }

    .view-dropdown button:hover {
        background: var(--color-button-bg-hover);
    }

    .view-dropdown button.active {
        background: var(--color-editor-link-bg);
        color: var(--color-accent);
        border-color: var(--color-accent);
        box-shadow: var(--shadow-soft);
    }
</style>

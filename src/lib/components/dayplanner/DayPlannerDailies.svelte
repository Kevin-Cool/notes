<script lang="ts">
    import { onMount, tick } from "svelte";

    import DailyContextMenu from "$lib/components/dayplanner/DailyContextMenu.svelte";

    import {
        createDayplannerDaily,
        deleteDayplannerDaily,
        getAllDayplannerDailies,
        upsertDayplannerDaily,
    } from "$lib/services/dayplanner-daily-service";

    import type { DayplannerDaily } from "$lib/types/dayplanner/dayplanner-daily";
    import type { DailyContextMenuState } from "$lib/components/dayplanner/DailyContextMenu.svelte";

    let dailies: DayplannerDaily[] = $state([]);
    let contextMenu: DailyContextMenuState | null = $state(null);

    let editingDailyId: string | null = $state(null);
    let editingTitle: string = $state("");
    let editingInputElement: HTMLInputElement | null = $state(null);

    let draggedDailyId: string | null = $state(null);
    let dragOverDailyId: string | null = $state(null);
    let dragStartOrderById: Map<string, number> | null = $state(null);

    const sortedDailies: DayplannerDaily[] = $derived.by(
        (): DayplannerDaily[] => {
            return [...dailies].sort(
                (left: DayplannerDaily, right: DayplannerDaily): number =>
                    left.orderNr - right.orderNr,
            );
        },
    );

    $effect((): void => {
        if (editingDailyId === null) {
            return;
        }

        void focusEditingInput();
    });

    async function focusEditingInput(): Promise<void> {
        await tick();

        if (!editingInputElement) {
            return;
        }

        editingInputElement.focus();
        editingInputElement.select();
    }

    onMount((): void => {
        void loadDailies();
    });

    async function loadDailies(): Promise<void> {
        dailies = await getAllDayplannerDailies();
    }

    function hasProgressCounter(daily: DayplannerDaily): boolean {
        return daily.target > 1;
    }

    function getClampedCompleted(daily: DayplannerDaily): number {
        return Math.max(0, Math.min(daily.completed, daily.target));
    }

    function getDailyState(
        daily: DayplannerDaily,
    ): "empty" | "partial" | "completed" {
        const completed: number = getClampedCompleted(daily);

        if (completed >= daily.target) {
            return "completed";
        }

        if (completed > 0) {
            return "partial";
        }

        return "empty";
    }

    function getNextOrderNr(): number {
        if (dailies.length === 0) {
            return 1;
        }

        return (
            Math.max(
                ...dailies.map(
                    (daily: DayplannerDaily): number => daily.orderNr,
                ),
            ) + 1
        );
    }

    function closeContextMenu(): void {
        contextMenu = null;
    }

    function handleEmptyContextMenu(event: MouseEvent): void {
        event.preventDefault();

        contextMenu = {
            mode: "empty",
            x: event.clientX,
            y: event.clientY,
        };
    }

    function handleDailyContextMenu(
        event: MouseEvent,
        daily: DayplannerDaily,
    ): void {
        event.preventDefault();
        event.stopPropagation();

        contextMenu = {
            mode: "daily",
            x: event.clientX,
            y: event.clientY,
            daily,
        };
    }

    async function createDaily(): Promise<void> {
        const createdDaily: DayplannerDaily = await createDayplannerDaily({
            title: "",
            orderNr: getNextOrderNr(),
            completed: 0,
            target: 1,
            completionDate: null,
        });

        dailies = [...dailies, createdDaily];

        startEditingDaily(createdDaily);
        closeContextMenu();
    }

    function startEditingDaily(daily: DayplannerDaily): void {
        editingDailyId = daily.id;
        editingTitle = daily.title ?? "";
        closeContextMenu();
    }

    async function saveEditingDaily(daily: DayplannerDaily): Promise<void> {
        if (editingDailyId !== daily.id) {
            return;
        }

        const title: string = editingTitle.trim();

        const updatedDaily: DayplannerDaily = await upsertDayplannerDaily({
            ...daily,
            title,
        });

        replaceDaily(updatedDaily);

        editingDailyId = null;
        editingTitle = "";
    }

    function cancelEditingDaily(): void {
        editingDailyId = null;
        editingTitle = "";
    }

    async function handleEditKeydown(
        event: KeyboardEvent,
        daily: DayplannerDaily,
    ): Promise<void> {
        if (event.key === "Enter") {
            event.preventDefault();
            await saveEditingDaily(daily);
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            cancelEditingDaily();
        }
    }

    async function deleteDaily(daily: DayplannerDaily): Promise<void> {
        await deleteDayplannerDaily(daily.id);

        dailies = dailies.filter(
            (currentDaily: DayplannerDaily): boolean =>
                currentDaily.id !== daily.id,
        );

        closeContextMenu();
    }

    async function changeTarget(
        daily: DayplannerDaily,
        target: number,
    ): Promise<void> {
        const safeTarget: number = Math.max(1, Math.min(10, target));
        const completed: number = Math.min(daily.completed, safeTarget);

        const updatedDaily: DayplannerDaily = await upsertDayplannerDaily({
            ...daily,
            target: safeTarget,
            completed,
            completionDate:
                completed >= safeTarget ? new Date().toISOString() : null,
        });

        replaceDaily(updatedDaily);

        if (
            contextMenu?.mode === "daily" &&
            contextMenu.daily.id === daily.id
        ) {
            contextMenu = {
                ...contextMenu,
                daily: updatedDaily,
            };
        }
    }

    async function toggleDaily(daily: DayplannerDaily): Promise<void> {
        const isCompleted: boolean = getClampedCompleted(daily) >= daily.target;
        const completed: number = isCompleted ? 0 : daily.target;

        const updatedDaily: DayplannerDaily = await upsertDayplannerDaily({
            ...daily,
            completed,
            completionDate:
                completed >= daily.target ? new Date().toISOString() : null,
        });

        replaceDaily(updatedDaily);
    }

    async function decreaseProgress(daily: DayplannerDaily): Promise<void> {
        const completed: number = Math.max(0, getClampedCompleted(daily) - 1);

        const updatedDaily: DayplannerDaily = await upsertDayplannerDaily({
            ...daily,
            completed,
            completionDate:
                completed >= daily.target ? new Date().toISOString() : null,
        });

        replaceDaily(updatedDaily);
    }

    async function increaseProgress(daily: DayplannerDaily): Promise<void> {
        const completed: number = Math.min(
            daily.target,
            getClampedCompleted(daily) + 1,
        );

        const updatedDaily: DayplannerDaily = await upsertDayplannerDaily({
            ...daily,
            completed,
            completionDate:
                completed >= daily.target ? new Date().toISOString() : null,
        });

        replaceDaily(updatedDaily);
    }

    function replaceDaily(updatedDaily: DayplannerDaily): void {
        dailies = dailies.map(
            (daily: DayplannerDaily): DayplannerDaily =>
                daily.id === updatedDaily.id ? updatedDaily : daily,
        );
    }
    function handleDailyPointerDown(
        event: PointerEvent,
        daily: DayplannerDaily,
    ): void {
        if (event.button !== 0) {
            return;
        }

        if (editingDailyId === daily.id || isDragBlockedTarget(event)) {
            return;
        }

        event.preventDefault();

        draggedDailyId = daily.id;
        dragOverDailyId = null;

        dragStartOrderById = new Map(
            sortedDailies.map(
                (currentDaily: DayplannerDaily): [string, number] => [
                    currentDaily.id,
                    currentDaily.orderNr,
                ],
            ),
        );

        const rowElement: HTMLElement = event.currentTarget as HTMLElement;
        rowElement.setPointerCapture(event.pointerId);

        closeContextMenu();
    }

    function handleDailyPointerMove(event: PointerEvent): void {
        if (!draggedDailyId) {
            return;
        }

        const targetElement: Element | null = document.elementFromPoint(
            event.clientX,
            event.clientY,
        );

        const targetRowElement: HTMLElement | null =
            targetElement?.closest<HTMLElement>(".daily-row") ?? null;

        const targetDailyId: string | undefined =
            targetRowElement?.dataset.dailyId;

        if (!targetDailyId || targetDailyId === draggedDailyId) {
            return;
        }

        dragOverDailyId = targetDailyId;

        reorderDailyLocally(draggedDailyId, targetDailyId);
    }

    async function handleDailyPointerUp(): Promise<void> {
        if (!draggedDailyId || !dragStartOrderById) {
            clearDailyDragState();
            return;
        }

        const changedDailies: DayplannerDaily[] = sortedDailies.filter(
            (daily: DayplannerDaily): boolean => {
                const originalOrderNr: number | undefined =
                    dragStartOrderById?.get(daily.id);

                return (
                    originalOrderNr !== undefined &&
                    originalOrderNr !== daily.orderNr
                );
            },
        );

        clearDailyDragState();

        if (changedDailies.length === 0) {
            return;
        }

        const savedDailies: DayplannerDaily[] = await Promise.all(
            changedDailies.map(
                async (daily: DayplannerDaily): Promise<DayplannerDaily> =>
                    await upsertDayplannerDaily(daily),
            ),
        );

        for (const savedDaily of savedDailies) {
            replaceDaily(savedDaily);
        }
    }

    function clearDailyDragState(): void {
        draggedDailyId = null;
        dragOverDailyId = null;
        dragStartOrderById = null;
    }

    function reorderDailyLocally(
        sourceDailyId: string,
        targetDailyId: string,
    ): void {
        const currentDailies: DayplannerDaily[] = [...sortedDailies];

        const sourceIndex: number = currentDailies.findIndex(
            (daily: DayplannerDaily): boolean => daily.id === sourceDailyId,
        );

        const targetIndex: number = currentDailies.findIndex(
            (daily: DayplannerDaily): boolean => daily.id === targetDailyId,
        );

        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
            return;
        }

        const reorderedDailies: DayplannerDaily[] = [...currentDailies];

        const movedDailies: DayplannerDaily[] = reorderedDailies.splice(
            sourceIndex,
            1,
        );

        const movedDaily: DayplannerDaily | undefined = movedDailies[0];

        if (!movedDaily) {
            return;
        }

        reorderedDailies.splice(targetIndex, 0, movedDaily);

        dailies = reorderedDailies.map(
            (daily: DayplannerDaily, index: number): DayplannerDaily => {
                return {
                    ...daily,
                    orderNr: index + 1,
                };
            },
        );
    }

    function isDragBlockedTarget(event: PointerEvent): boolean {
        const eventPath: EventTarget[] = event.composedPath();

        for (const target of eventPath) {
            if (!(target instanceof HTMLElement)) {
                continue;
            }

            if (target.hasAttribute("data-no-drag")) {
                return true;
            }

            if (target.classList.contains("daily-row")) {
                return false;
            }
        }

        return false;
    }
</script>

<svelte:window
    onpointermove={handleDailyPointerMove}
    onpointerup={() => {
        void handleDailyPointerUp();
    }}
/>

<section
    class="dayplanner-list-card"
    aria-label="Dailies"
    oncontextmenu={handleEmptyContextMenu}
>
    <header class="list-header">
        <h2>Dailies</h2>
    </header>

    <div class="list-content">
        {#each sortedDailies as daily (daily.id)}
            <div
                role="listitem"
                class="daily-row"
                data-daily-id={daily.id}
                class:is-partial={getDailyState(daily) === "partial"}
                class:is-completed={getDailyState(daily) === "completed"}
                class:is-dragging={draggedDailyId === daily.id}
                class:is-drag-over={dragOverDailyId === daily.id}
                onpointerdown={(event: PointerEvent): void =>
                    handleDailyPointerDown(event, daily)}
                oncontextmenu={(event: MouseEvent): void =>
                    handleDailyContextMenu(event, daily)}
            >
                {#if editingDailyId === daily.id}
                    <input
                        bind:this={editingInputElement}
                        bind:value={editingTitle}
                        class="daily-title-input"
                        data-no-drag
                        maxlength="1024"
                        onblur={() => {
                            void saveEditingDaily(daily);
                        }}
                        onkeydown={(event: KeyboardEvent): void => {
                            void handleEditKeydown(event, daily);
                        }}
                    />
                {:else}
                    <div
                        role="listitem"
                        class="daily-title-button"
                        ondblclick={() => startEditingDaily(daily)}
                        title="Double click to edit"
                    >
                        {daily.title || "Untitled daily"}
                    </div>
                {/if}

                {#if hasProgressCounter(daily)}
                    <div class="daily-counter" aria-label="Daily progress">
                        <button
                            type="button"
                            class="counter-button"
                            data-no-drag
                            aria-label="Decrease daily progress"
                            onclick={() => {
                                void decreaseProgress(daily);
                            }}
                        >
                            −
                        </button>

                        <span class="counter-value">
                            {getClampedCompleted(daily)}/{daily.target}
                        </span>

                        <button
                            type="button"
                            class="counter-button"
                            data-no-drag
                            aria-label="Increase daily progress"
                            onclick={() => {
                                void increaseProgress(daily);
                            }}
                        >
                            +
                        </button>
                    </div>
                {:else}
                    <button
                        type="button"
                        class="check-button"
                        data-no-drag
                        class:is-checked={getDailyState(daily) === "completed"}
                        aria-label={getDailyState(daily) === "completed"
                            ? "Mark daily as incomplete"
                            : "Mark daily as complete"}
                        onclick={() => {
                            void toggleDaily(daily);
                        }}
                    >
                        ✓
                    </button>
                {/if}
            </div>
        {/each}

        {#if sortedDailies.length === 0}
            <button
                type="button"
                class="empty-dailies"
                onclick={() => {
                    void createDaily();
                }}
            >
                No dailies yet. Click to create one.
            </button>
        {/if}
    </div>
</section>

<DailyContextMenu
    menu={contextMenu}
    onClose={closeContextMenu}
    onCreate={() => {
        void createDaily();
    }}
    onEdit={(daily: DayplannerDaily): void => {
        startEditingDaily(daily);
    }}
    onDelete={(daily: DayplannerDaily): void => {
        void deleteDaily(daily);
    }}
    onChangeTarget={(daily: DayplannerDaily, target: number): void => {
        void changeTarget(daily, target);
    }}
/>

<style>
    .dayplanner-list-card {
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        background: var(--color-surface);
    }

    .list-header {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-surface-strong);
        text-align: center;
    }

    .list-header h2 {
        margin: 0;
        color: var(--color-title);
        font-size: 1.1rem;
        user-select: none;
    }

    .list-content {
        min-height: 0;
        overflow-y: auto;
        padding: 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
    }

    .daily-row {
        --daily-accent: var(--color-border);

        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 1rem;
        padding: 0.65rem 0.7rem;
        border: 1px solid var(--color-border);
        border-radius: 0.85rem;
        background: var(--color-surface);
    }

    .daily-row.is-dragging {
        cursor: grabbing;
        opacity: 0.65;
    }

    .daily-row.is-drag-over {
        border-color: var(--daily-accent);
    }

    .daily-row.is-partial {
        --daily-accent: var(
            --color-dayplanner-partial,
            var(--color-task-yellow)
        );
        border-color: color-mix(
            in srgb,
            var(--daily-accent) 45%,
            var(--color-border) 55%
        );
        background: color-mix(
            in srgb,
            var(--daily-accent) 10%,
            var(--color-surface) 90%
        );
    }

    .daily-row.is-completed {
        --daily-accent: var(
            --color-dayplanner-completed,
            var(--color-task-green)
        );
        border-color: color-mix(
            in srgb,
            var(--daily-accent) 45%,
            var(--color-border) 55%
        );
        background: color-mix(
            in srgb,
            var(--daily-accent) 12%,
            var(--color-surface) 88%
        );
    }

    .daily-title-button {
        min-width: 0;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--color-title);
        font: inherit;
        font-size: 0.9rem;
        font-weight: 650;
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        user-select: none;
    }

    .daily-title-input {
        min-width: 0;
        width: 100%;
        box-sizing: border-box;

        border: 1px solid
            color-mix(in srgb, var(--daily-accent) 35%, var(--color-border) 65%);
        border-radius: 0.45rem;
        background: var(--color-surface);
        color: var(--color-title);
        padding: 0.25rem 0.4rem;
        font: inherit;
        font-size: 0.9rem;
        font-weight: 650;
    }

    .daily-title-input:focus {
        outline: none;
        border-color: var(--daily-accent);
        box-shadow: 0 0 0 2px
            color-mix(in srgb, var(--daily-accent) 20%, transparent 80%);
    }

    .is-completed .daily-title-button {
        color: var(--color-text-muted);
    }

    .daily-counter {
        display: grid;
        grid-template-columns: auto auto auto;
        align-items: center;
        gap: 0.35rem;
    }

    .counter-button,
    .check-button {
        width: 1.65rem;
        height: 1.65rem;
        border: 1px solid
            color-mix(in srgb, var(--daily-accent) 45%, var(--color-border) 55%);
        border-radius: 999px;
        background: var(--color-surface);
        color: var(--color-title);
        cursor: pointer;
        font-weight: 800;
    }

    .counter-value {
        min-width: 2.8rem;
        text-align: center;
        color: var(--color-text-muted);
        font-size: 0.8rem;
        font-weight: 700;
    }

    .check-button {
        color: transparent;
    }

    .check-button.is-checked {
        background: var(--daily-accent);
        color: var(--color-surface);
    }

    .empty-dailies {
        border: 1px dashed var(--color-border);
        border-radius: 0.85rem;
        background: transparent;
        color: var(--color-text-muted);
        padding: 0.9rem;
        cursor: pointer;
        user-select: none;
    }
</style>

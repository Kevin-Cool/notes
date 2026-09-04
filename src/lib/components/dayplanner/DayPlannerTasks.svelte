<script lang="ts">
    import { onMount } from "svelte";

    import TaskContextMenu from "$lib/components/tasks/TaskContextMenu.svelte";
    import TaskDialog from "$lib/components/tasks/TaskDialog.svelte";

    import {
        createCalendarTask,
        deleteCalendarTask,
        getCalendarTasksBetweenDates,
        upsertCalendarTask,
    } from "$lib/services/calendar-task-service";

    import type { CalendarTask } from "$lib/types/tasks/calendar-task";
    import type { CalendarTaskDraft } from "$lib/types/tasks/calendar-task-draft";
    import type { TaskContextMenuState } from "$lib/types/tasks/task-context-menu";

    import { TaskColor } from "$lib/types/tasks/task-color";

    let tasks: CalendarTask[] = $state([]);
    let contextMenu: TaskContextMenuState | null = $state(null);

    let isTaskDialogOpen: boolean = $state(false);
    let taskDialogMode: "create" | "update" = $state("create");
    let selectedTask: CalendarTask | null = $state(null);
    let createDialogStartDate: Date | null = $state(null);

    const sortedTasks: CalendarTask[] = $derived.by((): CalendarTask[] => {
        return [...tasks].sort(
            (left: CalendarTask, right: CalendarTask): number => {
                return (
                    toDate(left.start).getTime() - toDate(right.start).getTime()
                );
            },
        );
    });

    onMount((): void => {
        void loadTasks();
    });

    async function loadTasks(): Promise<void> {
        const rangeStart: Date = getTodayStart();
        const rangeEnd: Date = getThreeMonthsFromTodayEnd();

        tasks = await getCalendarTasksBetweenDates(rangeStart, rangeEnd);
    }

    function getTodayStart(): Date {
        const result: Date = new Date();
        result.setHours(0, 0, 0, 0);

        return result;
    }

    function getThreeMonthsFromTodayEnd(): Date {
        const result: Date = new Date();
        result.setMonth(result.getMonth() + 3);
        result.setHours(23, 59, 59, 999);

        return result;
    }

    function getDefaultCreateStartDate(): Date {
        const result: Date = new Date();
        const currentMinutes: number = result.getMinutes();
        const minutesUntilNextHalfHour: number =
            currentMinutes < 30 ? 30 - currentMinutes : 60 - currentMinutes;

        result.setMinutes(currentMinutes + minutesUntilNextHalfHour, 0, 0);

        return result;
    }

    function getDefaultCreateEndDate(startDate: Date): Date {
        const result: Date = new Date(startDate);
        result.setHours(result.getHours() + 1);

        return result;
    }

    function toDate(value: string | Date): Date {
        return value instanceof Date ? value : new Date(value);
    }

    function formatTaskDate(value: string | Date): string {
        const date: Date = toDate(value);

        const formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat([], {
            weekday: "short",
            day: "2-digit",
            month: "short",
        });

        return formatter.format(date);
    }

    function formatTaskTime(value: string | Date): string {
        const date: Date = toDate(value);

        const formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat([], {
            hour: "2-digit",
            minute: "2-digit",
        });

        return formatter.format(date);
    }

    function closeFloatingUi(): void {
        contextMenu = null;
    }

    function closeContextMenu(): void {
        contextMenu = null;
    }

    function handleWindowClick(): void {
        closeFloatingUi();
    }

    function handleWindowKeydown(event: KeyboardEvent): void {
        if (event.key !== "Escape") {
            return;
        }

        closeFloatingUi();
    }

    function handleEmptyContextMenu(event: MouseEvent): void {
        event.preventDefault();

        const start: Date = getDefaultCreateStartDate();
        const end: Date = getDefaultCreateEndDate(start);

        contextMenu = {
            mode: "empty",
            x: event.clientX,
            y: event.clientY,
            start,
            end,
        };
    }

    function handleTaskContextMenu(
        event: MouseEvent,
        task: CalendarTask,
    ): void {
        event.preventDefault();
        event.stopPropagation();

        contextMenu = {
            mode: "task",
            x: event.clientX,
            y: event.clientY,
            task,
        };
    }

    function handleTaskClick(task: CalendarTask): void {
        openUpdateDialog(task);
    }

    function openCreateDialog(startDate?: Date): void {
        taskDialogMode = "create";
        selectedTask = null;
        createDialogStartDate = startDate
            ? new Date(startDate)
            : getDefaultCreateStartDate();
        isTaskDialogOpen = true;
    }

    function openUpdateDialog(task: CalendarTask): void {
        taskDialogMode = "update";
        selectedTask = task;
        createDialogStartDate = null;
        isTaskDialogOpen = true;
        closeContextMenu();
    }

    function closeTaskDialog(): void {
        isTaskDialogOpen = false;
        selectedTask = null;
        createDialogStartDate = null;
    }

    async function handleCreateFromContextMenu(): Promise<void> {
        if (contextMenu === null || contextMenu.mode !== "empty") {
            return;
        }

        openCreateDialog(contextMenu.start);
        closeContextMenu();
    }

    async function handleEditFromContextMenu(
        task: CalendarTask,
    ): Promise<void> {
        openUpdateDialog(task);
        closeContextMenu();
    }

    async function handleChangeTaskColor(
        task: CalendarTask,
        color: TaskColor,
    ): Promise<void> {
        const updatedTask: CalendarTask = await upsertCalendarTask({
            ...task,
            color,
        });

        replaceTask(updatedTask);
        closeContextMenu();
    }

    async function handleTaskDialogSubmit(
        draft: CalendarTaskDraft,
    ): Promise<void> {
        if (taskDialogMode === "create") {
            const createdTask: CalendarTask = await createCalendarTask({
                title: draft.title,
                description: draft.description,
                start: draft.start,
                end: draft.end,
                color: draft.color,
            });

            tasks = [...tasks, createdTask];
            closeTaskDialog();
            return;
        }

        if (selectedTask === null) {
            return;
        }

        const updatedTask: CalendarTask = await upsertCalendarTask({
            ...selectedTask,
            title: draft.title,
            description: draft.description,
            start: draft.start,
            end: draft.end,
            color: draft.color,
        });

        replaceTask(updatedTask);
        closeTaskDialog();
    }

    async function handleTaskDialogDelete(): Promise<void> {
        if (selectedTask === null || !selectedTask.id) {
            return;
        }

        await deleteCalendarTask(selectedTask.id);

        tasks = tasks.filter(
            (task: CalendarTask): boolean => task.id !== selectedTask!.id,
        );

        closeTaskDialog();
    }

    function replaceTask(updatedTask: CalendarTask): void {
        tasks = tasks.map(
            (task: CalendarTask): CalendarTask =>
                task.id === updatedTask.id ? updatedTask : task,
        );
    }
    let taskStripElement: HTMLDivElement | null = $state(null);

    function handleTaskStripWheel(event: WheelEvent): void {
        if (!taskStripElement) {
            return;
        }

        const hasHorizontalScroll: boolean =
            taskStripElement.scrollWidth > taskStripElement.clientWidth;

        if (!hasHorizontalScroll) {
            return;
        }

        const scrollAmount: number =
            Math.abs(event.deltaY) >= Math.abs(event.deltaX)
                ? event.deltaY
                : event.deltaX;

        if (scrollAmount === 0) {
            return;
        }

        event.preventDefault();

        taskStripElement.scrollLeft += scrollAmount;
    }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<section
    class="dayplanner-tasks"
    aria-label="Upcoming tasks"
    oncontextmenu={handleEmptyContextMenu}
>
    <div
        class="task-strip"
        bind:this={taskStripElement}
        onwheel={handleTaskStripWheel}
    >
        {#each sortedTasks as task (task.id)}
            <button
                type="button"
                class={`task-chip task-color-${task.color}`}
                onclick={() => handleTaskClick(task)}
                oncontextmenu={(event: MouseEvent): void =>
                    handleTaskContextMenu(event, task)}
                title={`${task.title} • ${formatTaskDate(task.start)} • ${formatTaskTime(task.start)} – ${formatTaskTime(task.end)}`}
            >
                <div class="task-chip-title">
                    {task.title}
                </div>

                <div class="task-chip-date">
                    {formatTaskDate(task.start)}
                </div>

                <div class="task-chip-time">
                    {formatTaskTime(task.start)} – {formatTaskTime(task.end)}
                </div>
            </button>
        {/each}

        {#if sortedTasks.length === 0}
            <div class="empty-tasks">
                No tasks planned for the next 3 months.
            </div>
        {/if}
    </div>
</section>

<TaskContextMenu
    menu={contextMenu}
    onClose={closeContextMenu}
    onCreate={(): void => {
        void handleCreateFromContextMenu();
    }}
    onEdit={(task: CalendarTask): void => {
        void handleEditFromContextMenu(task);
    }}
    onChangeColor={(task: CalendarTask, color: TaskColor): void => {
        void handleChangeTaskColor(task, color);
    }}
/>

<TaskDialog
    isOpen={isTaskDialogOpen}
    mode={taskDialogMode}
    initialTask={selectedTask}
    initialStartDate={createDialogStartDate}
    onClose={closeTaskDialog}
    onSubmit={(draft: CalendarTaskDraft): void => {
        void handleTaskDialogSubmit(draft);
    }}
    onDelete={(): void => {
        void handleTaskDialogDelete();
    }}
/>

<style>
    .dayplanner-tasks {
        min-width: 0;
        border: 1px solid var(--color-border);
        border-radius: 1.1rem;
        background: var(--color-surface);
        box-shadow: var(--shadow-soft);
        padding: 0.85rem;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 0.85rem;
        align-items: center;
        overflow: hidden;
    }

    .task-strip {
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;

        display: flex;
        gap: 0.75rem;
        overflow-x: auto;
        overflow-y: hidden;
        padding: 0.1rem 0.15rem 0.35rem;
        scrollbar-width: thin;
        overscroll-behavior: contain;
    }

    .task-chip {
        --task-accent: var(--color-accent);
        --task-card-bg: color-mix(
            in srgb,
            var(--task-accent) 10%,
            var(--color-surface) 90%
        );
        --task-card-border: color-mix(
            in srgb,
            var(--task-accent) 35%,
            var(--color-surface) 65%
        );

        flex: 0 0 15rem;
        min-width: 0;
        height: 100%;

        border: 1px solid var(--task-card-border);
        border-left: 4px solid var(--task-accent);
        border-radius: 0.85rem;
        background: var(--task-card-bg);
        padding: 0.75rem 0.85rem;
        box-shadow: var(--shadow-soft);
        text-align: left;
        cursor: pointer;
    }

    .task-chip:hover {
        box-shadow: var(--shadow-soft-hover);
        transform: translateY(-1px);
    }

    .task-chip-title {
        color: var(--color-title);
        font-size: 0.9rem;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .task-chip-date {
        margin-top: 0.3rem;
        color: var(--color-title);
        font-size: 0.78rem;
        font-weight: 700;
    }

    .task-chip-time {
        margin-top: 0.15rem;
        color: var(--color-text-muted);
        font-size: 0.75rem;
    }

    .empty-tasks {
        flex: 1 0 100%;
        min-height: 100%;

        display: grid;
        place-items: center;

        color: var(--color-text-muted);
        user-select: none;
        font-size: 0.9rem;
        text-align: center;
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

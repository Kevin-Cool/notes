<script lang="ts">
    import type { CalendarTask } from "$lib/types/tasks/calendar-task";
    import type { EmptyContextMenuDetail } from "$lib/types/tasks/empty-context-menu-detail";
    import type { TaskContextMenuDetail } from "$lib/types/tasks/task-context-menu-detail";

    let {
        tasks,
        date,
        onEmptyContextMenu,
        onTaskContextMenu,
        onTaskClick,
        onVisibleDateChange,
        onRequestDateRange,
        onDayClick,
        onTaskMove,
    }: {
        tasks: CalendarTask[];
        date: Date;
        onEmptyContextMenu?: (detail: EmptyContextMenuDetail) => void;
        onTaskContextMenu?: (detail: TaskContextMenuDetail) => void;
        onTaskClick?: (task: CalendarTask) => void;
        onVisibleDateChange?: (detail: { date: Date }) => void;
        onRequestDateRange?: (detail: {
            start: Date;
            end: Date;
        }) => void | Promise<void>;
        onDayClick?: (detail: { date: Date }) => void;
        onTaskMove?: (detail: {
            task: CalendarTask;
            start: Date;
            end: Date;
        }) => void | Promise<void>;
    } = $props();

    type MonthDragState = {
        task: CalendarTask;
        pointerId: number;
        timerId: number | null;
        isActive: boolean;
        durationMs: number;
        originalStart: Date;
        originalEnd: Date;
        currentStart: Date;
        currentEnd: Date;
    };

    let dragState: MonthDragState | null = $state(null);
    let suppressedClickTaskId: CalendarTask["id"] | null = $state(null);

    const dragActivationDelayMs: number = 200;
    const daysInWeek: number = 7;
    const visibleWeeks: number = 6;
    const visibleDayCount: number = daysInWeek * visibleWeeks;
    const maxVisibleTasksPerDay: number = 3;

    const visibleDays: Date[] = $derived(buildVisibleMonthDays(date));

    function getTaskRenderRange(task: CalendarTask): {
        start: Date;
        end: Date;
    } {
        if (dragState?.isActive && dragState.task.id === task.id) {
            return {
                start: dragState.currentStart,
                end: dragState.currentEnd,
            };
        }

        return {
            start: toDate(task.start),
            end: toDate(task.end),
        };
    }

    function getDayFromPointer(clientX: number, clientY: number): Date | null {
        const element: Element | null = document.elementFromPoint(
            clientX,
            clientY,
        );

        if (!element) {
            return null;
        }

        const dayElement: HTMLElement | null =
            element.closest<HTMLElement>("[data-month-day]");

        if (!dayElement) {
            return null;
        }

        const dateValue: string | undefined = dayElement.dataset.monthDay;

        if (!dateValue) {
            return null;
        }

        return new Date(`${dateValue}T00:00:00`);
    }

    function buildMovedRangeForDay(
        day: Date,
        state: MonthDragState,
    ): { start: Date; end: Date } {
        const start: Date = getStartOfDay(day);

        start.setHours(
            state.originalStart.getHours(),
            state.originalStart.getMinutes(),
            0,
            0,
        );

        const end: Date = new Date(start.getTime() + state.durationMs);

        return { start, end };
    }

    function getDragRangeFromPointer(
        clientX: number,
        clientY: number,
        state: MonthDragState,
    ): { start: Date; end: Date } | null {
        const day: Date | null = getDayFromPointer(clientX, clientY);

        if (!day) {
            return null;
        }

        return buildMovedRangeForDay(day, state);
    }

    function normalizeDate(value: Date): Date {
        const result: Date = new Date(value);
        result.setHours(0, 0, 0, 0);
        return result;
    }

    function addDays(value: Date, amount: number): Date {
        const result: Date = normalizeDate(value);
        result.setDate(result.getDate() + amount);
        return normalizeDate(result);
    }

    function getStartOfMonth(value: Date): Date {
        const result: Date = normalizeDate(value);
        result.setDate(1);
        return result;
    }

    function getStartOfWeek(value: Date): Date {
        const result: Date = normalizeDate(value);
        const dayOfWeek: number = result.getDay();
        const distanceFromMonday: number = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        result.setDate(result.getDate() - distanceFromMonday);
        return normalizeDate(result);
    }

    function getStartOfDay(value: Date): Date {
        const result: Date = new Date(value);
        result.setHours(0, 0, 0, 0);
        return result;
    }

    function getEndOfDay(value: Date): Date {
        const result: Date = new Date(value);
        result.setHours(23, 59, 59, 999);
        return result;
    }

    function buildVisibleMonthDays(value: Date): Date[] {
        const monthStart: Date = getStartOfMonth(value);
        const gridStart: Date = getStartOfWeek(monthStart);

        return Array.from(
            { length: visibleDayCount },
            (_: unknown, index: number): Date => addDays(gridStart, index),
        );
    }

    function getDateKey(value: Date): string {
        return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
    }

    function areSameDay(left: Date, right: Date): boolean {
        return (
            left.getFullYear() === right.getFullYear() &&
            left.getMonth() === right.getMonth() &&
            left.getDate() === right.getDate()
        );
    }

    function isToday(value: Date): boolean {
        return areSameDay(value, new Date());
    }

    function isCurrentMonth(value: Date): boolean {
        return (
            value.getFullYear() === date.getFullYear() &&
            value.getMonth() === date.getMonth()
        );
    }

    function toDate(value: string | Date): Date {
        return value instanceof Date ? value : new Date(value);
    }

    function formatWeekday(value: Date): string {
        return value.toLocaleDateString(undefined, {
            weekday: "short",
        });
    }

    function formatDayNumber(value: Date): string {
        return String(value.getDate());
    }

    function formatTime(value: Date): string {
        return value.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
        });
    }

    function getTasksForDay(day: Date): CalendarTask[] {
        const dayStart: Date = getStartOfDay(day);
        const dayEnd: Date = getEndOfDay(day);

        return tasks
            .filter((task: CalendarTask): boolean => {
                const range: { start: Date; end: Date } =
                    getTaskRenderRange(task);
                const taskStart: Date = range.start;
                const taskEnd: Date = range.end;

                return (
                    taskEnd.getTime() > dayStart.getTime() &&
                    taskStart.getTime() < dayEnd.getTime()
                );
            })
            .sort((left: CalendarTask, right: CalendarTask): number => {
                return (
                    toDate(left.start).getTime() - toDate(right.start).getTime()
                );
            });
    }
    function handleTaskPointerDown(
        event: PointerEvent,
        task: CalendarTask,
    ): void {
        if (event.button !== 0) {
            return;
        }

        const taskStart: Date = toDate(task.start);
        const taskEnd: Date = toDate(task.end);
        const durationMs: number = Math.max(
            15 * 60 * 1000,
            taskEnd.getTime() - taskStart.getTime(),
        );

        const timerId: number = window.setTimeout((): void => {
            if (!dragState || dragState.pointerId !== event.pointerId) {
                return;
            }

            dragState = {
                ...dragState,
                isActive: true,
            };
        }, dragActivationDelayMs);

        dragState = {
            task,
            pointerId: event.pointerId,
            timerId,
            isActive: false,
            durationMs,
            originalStart: taskStart,
            originalEnd: taskEnd,
            currentStart: taskStart,
            currentEnd: taskEnd,
        };
    }

    function handleTaskPointerMove(event: PointerEvent): void {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        if (!dragState.isActive) {
            return;
        }

        event.preventDefault();

        const range: { start: Date; end: Date } | null =
            getDragRangeFromPointer(event.clientX, event.clientY, dragState);

        if (!range) {
            return;
        }

        dragState = {
            ...dragState,
            currentStart: range.start,
            currentEnd: range.end,
        };
    }

    async function handleTaskPointerUp(event: PointerEvent): Promise<void> {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        const state: MonthDragState = dragState;

        if (state.timerId !== null) {
            window.clearTimeout(state.timerId);
        }

        const finalRange: { start: Date; end: Date } | null = state.isActive
            ? getDragRangeFromPointer(event.clientX, event.clientY, state)
            : null;

        dragState = null;

        if (!state.isActive || !finalRange) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        suppressedClickTaskId = state.task.id;

        window.setTimeout((): void => {
            suppressedClickTaskId = null;
        }, 0);

        await onTaskMove?.({
            task: state.task,
            start: finalRange.start,
            end: finalRange.end,
        });
    }

    function handleTaskPointerCancel(event: PointerEvent): void {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        if (dragState.timerId !== null) {
            window.clearTimeout(dragState.timerId);
        }

        dragState = null;
    }

    function handleTaskClick(event: MouseEvent, task: CalendarTask): void {
        if (suppressedClickTaskId === task.id) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        onTaskClick?.(task);
    }

    function getVisibleTasksForDay(day: Date): CalendarTask[] {
        return getTasksForDay(day).slice(0, maxVisibleTasksPerDay);
    }

    function getHiddenTaskCountForDay(day: Date): number {
        return Math.max(0, getTasksForDay(day).length - maxVisibleTasksPerDay);
    }

    function getDefaultCreateStart(day: Date): Date {
        const result: Date = getStartOfDay(day);
        result.setHours(9, 0, 0, 0);
        return result;
    }

    function getDefaultCreateEnd(day: Date): Date {
        const result: Date = getDefaultCreateStart(day);
        result.setHours(result.getHours() + 1);
        return result;
    }

    function handleEmptyContextMenu(event: MouseEvent, day: Date): void {
        event.preventDefault();

        onEmptyContextMenu?.({
            x: event.clientX,
            y: event.clientY,
            start: getDefaultCreateStart(day),
            end: getDefaultCreateEnd(day),
        });
    }

    function handleTaskContextMenu(
        event: MouseEvent,
        task: CalendarTask,
    ): void {
        event.preventDefault();
        event.stopPropagation();

        onTaskContextMenu?.({
            x: event.clientX,
            y: event.clientY,
            task,
        });
    }

    async function requestVisibleDateRange(): Promise<void> {
        if (visibleDays.length === 0) {
            return;
        }

        await onRequestDateRange?.({
            start: getStartOfDay(visibleDays[0]),
            end: getEndOfDay(visibleDays[visibleDays.length - 1]),
        });
    }

    let lastRequestedRangeKey: string = $state("");

    function formatDateInputValue(value: Date): string {
        const year: string = String(value.getFullYear());
        const month: string = String(value.getMonth() + 1).padStart(2, "0");
        const day: string = String(value.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    $effect((): void => {
        if (visibleDays.length === 0) {
            return;
        }

        const start: Date = getStartOfDay(visibleDays[0]);
        const end: Date = getEndOfDay(visibleDays[visibleDays.length - 1]);
        const rangeKey: string = `${getDateKey(start)}_${getDateKey(end)}`;

        if (rangeKey === lastRequestedRangeKey) {
            return;
        }

        lastRequestedRangeKey = rangeKey;

        void onRequestDateRange?.({
            start,
            end,
        });
    });
</script>

<svelte:window
    onpointermove={handleTaskPointerMove}
    onpointerup={(event: PointerEvent): void => {
        void handleTaskPointerUp(event);
    }}
    onpointercancel={handleTaskPointerCancel}
/>

<div class="month-view">
    <div class="month-weekdays">
        {#each visibleDays.slice(0, daysInWeek) as day (getDateKey(day))}
            <div class="weekday-label">
                {formatWeekday(day)}
            </div>
        {/each}
    </div>

    <div class="month-grid">
        {#each visibleDays as day (getDateKey(day))}
            <div
                class="month-day"
                class:today={isToday(day)}
                class:outside-month={!isCurrentMonth(day)}
                data-month-day={formatDateInputValue(day)}
                role="presentation"
                oncontextmenu={(event: MouseEvent): void =>
                    handleEmptyContextMenu(event, day)}
            >
                <button
                    type="button"
                    class="day-number"
                    class:today={isToday(day)}
                    onclick={(event: MouseEvent): void => {
                        event.stopPropagation();
                        onDayClick?.({ date: day });
                    }}
                    title="Select day"
                >
                    {formatDayNumber(day)}
                </button>

                <div class="month-task-list">
                    {#each getVisibleTasksForDay(day) as task (task.id)}
                        <button
                            type="button"
                            class={`month-task task-color-${task.color}`}
                            class:is-dragging={dragState?.task.id === task.id}
                            onclick={(event: MouseEvent): void =>
                                handleTaskClick(event, task)}
                            onpointerdown={(event: PointerEvent): void =>
                                handleTaskPointerDown(event, task)}
                            oncontextmenu={(event: MouseEvent): void =>
                                handleTaskContextMenu(event, task)}
                            title={`${task.title} • ${formatTime(getTaskRenderRange(task).start)}`}
                        >
                            <span class="month-task-time">
                                {formatTime(getTaskRenderRange(task).start)}
                            </span>
                            <span class="month-task-title">
                                {task.title}
                            </span>
                        </button>
                    {/each}

                    {#if getHiddenTaskCountForDay(day) > 0}
                        <div class="more-tasks">
                            +{getHiddenTaskCountForDay(day)} more
                        </div>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .month-view {
        width: 100%;
        height: 100%;
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        background: var(--color-surface);
        overflow: hidden;
        user-select: none;
    }

    .month-weekdays {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        border-bottom: 1px solid var(--color-border);
        background: var(--color-surface);
    }

    .weekday-label {
        padding: 0.55rem 0.6rem;
        border-right: 1px solid var(--color-border);
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--color-text-muted);
        text-align: center;
        user-select: none;
        -webkit-user-select: none;
    }

    .weekday-label:last-child {
        border-right: 0;
    }

    .month-grid {
        min-height: 0;
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        grid-template-rows: repeat(6, minmax(0, 1fr));
        overflow: hidden;
    }

    .month-day {
        min-width: 0;
        min-height: 0;
        border-right: 1px solid var(--color-border);
        border-bottom: 1px solid var(--color-border);
        padding: 0.45rem;
        background: var(--color-surface);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 0.35rem;
    }

    .month-day:nth-child(7n) {
        border-right: 0;
    }

    .month-day.outside-month {
        background: var(--color-calendar-outside-month-bg);
        color: var(--color-calendar-outside-month-text);
    }

    .month-day.outside-month .day-number {
        color: var(--color-calendar-outside-month-text);
    }

    .month-day.outside-month .month-task {
        opacity: 0.72;
    }

    .month-day.today {
        background: color-mix(
            in srgb,
            var(--color-accent) 5%,
            var(--color-surface)
        );
    }

    .day-number {
        justify-self: start;
        width: 1.85rem;
        height: 1.85rem;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: var(--color-text);
        font: inherit;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        user-select: none;
    }

    .day-number:hover {
        background: var(--color-button-bg-hover);
    }

    .day-number.today {
        background: var(--color-accent);
        color: white !important;
    }

    .month-task-list {
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        overflow: hidden;
    }

    .month-task {
        --task-accent: var(--color-accent);
        --task-card-bg: color-mix(in srgb, var(--task-accent) 10%, var(--color-surface) 90%);
        --task-card-border: color-mix(in srgb, var(--task-accent) 35%, var(--color-surface) 65%);

        border: 1px solid var(--task-card-border);
        border-left: 4px solid var(--task-accent);
        background: var(--task-card-bg);

        width: 100%;
        min-width: 0;
        border-radius: 0.45rem;
        color: var(--color-title);
        padding: 0.25rem 0.35rem;
        display: flex;
        gap: 0.3rem;
        align-items: center;
        text-align: left;
        cursor: pointer;
        font: inherit;
        font-size: 0.72rem;
        overflow: hidden;
    }

    .month-task:hover {
        box-shadow: var(--shadow-soft);
    }

    .month-task-time {
        flex: 0 0 auto;
        color: var(--color-text-muted);
        font-size: 0.68rem;
    }

    .month-task-title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
    }

    .more-tasks {
        padding: 0.1rem 0.25rem;
        font-size: 0.72rem;
        color: var(--color-text-muted);
        user-select: none;
        -webkit-user-select: none;
    }

    .month-task {
        touch-action: none;
    }

    .month-task.is-dragging {
        z-index: 20;
        opacity: 0.9;
        cursor: grabbing;
        box-shadow: var(--shadow-soft-hover);
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

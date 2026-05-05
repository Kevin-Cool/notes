<script lang="ts">
    import { onMount, tick } from "svelte";
    import type { CalendarTask } from "$lib/types/tasks/calendar-task";
    import type { EmptyContextMenuDetail } from "$lib/types/tasks/empty-context-menu-detail";
    import type { TaskContextMenuDetail } from "$lib/types/tasks/task-context-menu-detail";

    let {
        tasks,
        date,
        hourHeight = 72,
        dayWidth = 180,
        onEmptyContextMenu,
        onTaskContextMenu,
        onTaskClick,
        onVisibleDateChange,
        onRequestDateRange,
        onTaskMove,
    }: {
        tasks: CalendarTask[];
        date: Date;
        hourHeight?: number;
        dayWidth?: number;
        onEmptyContextMenu?: (detail: EmptyContextMenuDetail) => void;
        onTaskContextMenu?: (detail: TaskContextMenuDetail) => void;
        onTaskClick?: (task: CalendarTask) => void;
        onVisibleDateChange?: (detail: { date: Date }) => void;
        onRequestDateRange?: (detail: {
            start: Date;
            end: Date;
        }) => void | Promise<void>;
        onTaskMove?: (detail: {
            task: CalendarTask;
            start: Date;
            end: Date;
        }) => void | Promise<void>;
    } = $props();

    type PositionedWeekTask = {
        task: CalendarTask;
        day: Date;
        top: number;
        height: number;
    };

    type TaskDateRange = {
        start: Date;
        end: Date;
    };

    type WeekDragState = {
        task: CalendarTask;
        pointerId: number;
        timerId: number | null;
        isActive: boolean;
        durationMinutes: number;
        grabbedOffsetMinutes: number;
        currentStart: Date;
        currentEnd: Date;
    };

    // svelte-ignore state_referenced_locally
    const initialDate: Date = date;
    let days: Date[] = $state(buildInitialDays(initialDate));

    let scrollContainerElement: HTMLDivElement | null = null;
    let isAdjustingScroll: boolean = false;
    let lastReportedDateKey: string = $state("");
    let hasInitialScrollPositioned: boolean = false;
    let now: Date = $state(new Date());

    let dragState: WeekDragState | null = $state(null);
    let suppressedClickTaskId: CalendarTask["id"] | null = $state(null);

    const hoursInDay: number = 24;
    const minutesInDay: number = 24 * 60;
    const timeAxisWidthPx: number = 52;
    const minimumTaskHeightPx: number = 28;
    const edgeThresholdPx: number = 320;
    const daysToAddAtEdge: number = 7;

    const totalDayHeightPx: number = $derived(hoursInDay * hourHeight);
    const gridWidthPx: number = $derived(
        timeAxisWidthPx + days.length * dayWidth,
    );

    const currentTimeTopPx: number = $derived(
        ((now.getHours() * 60 + now.getMinutes()) / 60) * hourHeight,
    );

    const dragActivationDelayMs: number = 200;
    const dragSnapMinutes: number = 15;

    function getTaskRenderRange(task: CalendarTask): TaskDateRange {
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

    function getMinuteOfDayFromPointer(clientY: number): number | null {
        if (!scrollContainerElement) {
            return null;
        }

        const containerRect: DOMRect =
            scrollContainerElement.getBoundingClientRect();

        const offsetY: number =
            clientY -
            containerRect.top +
            scrollContainerElement.scrollTop -
            headerHeightPx;

        const clampedOffsetY: number = Math.max(
            0,
            Math.min(totalDayHeightPx, offsetY),
        );

        return Math.floor((clampedOffsetY / hourHeight) * 60);
    }

    function getDayFromPointer(clientX: number): Date | null {
        if (!scrollContainerElement || days.length === 0) {
            return null;
        }

        const containerRect: DOMRect =
            scrollContainerElement.getBoundingClientRect();

        const offsetX: number =
            clientX -
            containerRect.left +
            scrollContainerElement.scrollLeft -
            timeAxisWidthPx;

        const dayIndex: number = Math.max(
            0,
            Math.min(days.length - 1, Math.floor(offsetX / dayWidth)),
        );

        return days[dayIndex];
    }

    function snapMinute(value: number): number {
        return Math.round(value / dragSnapMinutes) * dragSnapMinutes;
    }

    function getDragRangeFromPointer(
        clientX: number,
        clientY: number,
        state: WeekDragState,
    ): TaskDateRange | null {
        const day: Date | null = getDayFromPointer(clientX);
        const pointerMinute: number | null = getMinuteOfDayFromPointer(clientY);

        if (!day || pointerMinute === null) {
            return null;
        }

        const latestStartMinute: number = Math.max(
            0,
            minutesInDay - state.durationMinutes,
        );

        const startMinute: number = Math.max(
            0,
            Math.min(
                latestStartMinute,
                snapMinute(pointerMinute - state.grabbedOffsetMinutes),
            ),
        );

        const start: Date = getStartOfDay(day);
        start.setMinutes(startMinute);

        const end: Date = new Date(start);
        end.setMinutes(start.getMinutes() + state.durationMinutes);

        return { start, end };
    }

    function formatCurrentTime(value: Date): string {
        return value.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
        });
    }

    export function scrollToDate(targetDate: Date): void {
        void jumpToDate(targetDate);
    }

    async function jumpToDate(targetDate: Date): Promise<void> {
        const normalizedTargetDate: Date = normalizeDate(targetDate);

        const hasTargetDate: boolean = days.some((day: Date): boolean =>
            areSameDay(day, normalizedTargetDate),
        );

        if (!hasTargetDate) {
            days = buildInitialDays(normalizedTargetDate);
            lastReportedDateKey = "";
            await tick();
            await requestCurrentDateRange();
        }

        await centerDateInView(normalizedTargetDate);
    }

    function isMonday(value: Date): boolean {
        return value.getDay() === 1;
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

    function buildInitialDays(centerDate: Date): Date[] {
        const start: Date = addDays(centerDate, -10);

        return Array.from({ length: 21 }, (_: unknown, index: number): Date => {
            return addDays(start, index);
        });
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
        return areSameDay(value, now);
    }

    function toDate(value: string | Date): Date {
        return value instanceof Date ? value : new Date(value);
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

    function formatHourLabel(hour: number): string {
        return `${hour.toString().padStart(2, "0")}:00`;
    }

    function formatWeekday(value: Date): string {
        return value.toLocaleDateString(undefined, {
            weekday: "short",
        });
    }

    function formatDayMonth(value: Date): string {
        return value.toLocaleDateString(undefined, {
            day: "2-digit",
            month: "2-digit",
        });
    }

    function formatTimeRange(start: Date, end: Date): string {
        const formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat([], {
            hour: "numeric",
            minute: "2-digit",
        });

        return `${formatter.format(start)} – ${formatter.format(end)}`;
    }

    function minutesSinceDayStart(value: Date, dayStart: Date): number {
        return Math.max(
            0,
            Math.min(
                minutesInDay,
                Math.floor((value.getTime() - dayStart.getTime()) / 60000),
            ),
        );
    }

    function getTimeRangeFromPointer(
        day: Date,
        clientY: number,
    ): { start: Date; end: Date } | null {
        if (!scrollContainerElement) {
            return null;
        }

        const containerRect: DOMRect =
            scrollContainerElement.getBoundingClientRect();
        const offsetY: number =
            clientY -
            containerRect.top +
            scrollContainerElement.scrollTop -
            headerHeightPx;
        const clampedOffsetY: number = Math.max(
            0,
            Math.min(totalDayHeightPx, offsetY),
        );
        const minuteOfDay: number = Math.floor(
            (clampedOffsetY / hourHeight) * 60,
        );
        const snappedMinute: number = Math.floor(minuteOfDay / 30) * 30;

        const start: Date = getStartOfDay(day);
        start.setMinutes(snappedMinute);

        const end: Date = new Date(start);
        end.setMinutes(start.getMinutes() + 30);

        return { start, end };
    }

    function handleEmptySpaceContextMenu(event: MouseEvent, day: Date): void {
        event.preventDefault();

        const range: { start: Date; end: Date } | null =
            getTimeRangeFromPointer(day, event.clientY);

        if (!range) {
            return;
        }

        onEmptyContextMenu?.({
            x: event.clientX,
            y: event.clientY,
            start: range.start,
            end: range.end,
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

    function handleTaskPointerDown(
        event: PointerEvent,
        task: CalendarTask,
    ): void {
        if (event.button !== 0) {
            return;
        }

        const taskStart: Date = toDate(task.start);
        const taskEnd: Date = toDate(task.end);

        const durationMinutes: number = Math.max(
            15,
            Math.round((taskEnd.getTime() - taskStart.getTime()) / 60000),
        );

        const pointerMinute: number | null = getMinuteOfDayFromPointer(
            event.clientY,
        );

        if (pointerMinute === null) {
            return;
        }

        const taskStartMinute: number = minutesSinceDayStart(
            taskStart,
            getStartOfDay(taskStart),
        );

        const grabbedOffsetMinutes: number = Math.max(
            0,
            Math.min(durationMinutes, pointerMinute - taskStartMinute),
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
            durationMinutes,
            grabbedOffsetMinutes,
            currentStart: taskStart,
            currentEnd: taskEnd,
        };

        const target: HTMLButtonElement =
            event.currentTarget as HTMLButtonElement;

        if (target.hasPointerCapture(event.pointerId)) {
            target.releasePointerCapture(event.pointerId);
        }
    }

    function handleTaskPointerMove(event: PointerEvent): void {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        if (!dragState.isActive) {
            return;
        }

        event.preventDefault();

        const range: TaskDateRange | null = getDragRangeFromPointer(
            event.clientX,
            event.clientY,
            dragState,
        );

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

        const state: WeekDragState = dragState;

        if (state.timerId !== null) {
            window.clearTimeout(state.timerId);
        }

        const finalRange: TaskDateRange | null = state.isActive
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
    function getTasksForDay(day: Date): CalendarTask[] {
        const dayStart: Date = getStartOfDay(day);
        const dayEnd: Date = getEndOfDay(day);

        return tasks.filter((task: CalendarTask): boolean => {
            const range: TaskDateRange = getTaskRenderRange(task);
            const taskStart: Date = range.start;
            const taskEnd: Date = range.end;

            return (
                taskEnd.getTime() > dayStart.getTime() &&
                taskStart.getTime() < dayEnd.getTime()
            );
        });
    }

    function getPositionedTasksForDay(day: Date): PositionedWeekTask[] {
        const dayStart: Date = getStartOfDay(day);
        const dayEnd: Date = getEndOfDay(day);

        return getTasksForDay(day).map(
            (task: CalendarTask): PositionedWeekTask => {
                const range: TaskDateRange = getTaskRenderRange(task);
                const taskStart: Date = range.start;
                const taskEnd: Date = range.end;

                const clampedStartMinute: number = minutesSinceDayStart(
                    taskStart < dayStart ? dayStart : taskStart,
                    dayStart,
                );

                const clampedEndMinute: number = minutesSinceDayStart(
                    taskEnd > dayEnd ? dayEnd : taskEnd,
                    dayStart,
                );

                const top: number = (clampedStartMinute / 60) * hourHeight;
                const height: number = Math.max(
                    minimumTaskHeightPx,
                    ((Math.max(clampedStartMinute + 1, clampedEndMinute) -
                        clampedStartMinute) /
                        60) *
                        hourHeight,
                );

                return {
                    task,
                    day,
                    top,
                    height,
                };
            },
        );
    }

    async function requestCurrentDateRange(): Promise<void> {
        if (days.length === 0) {
            return;
        }

        const start: Date = getStartOfDay(days[0]);
        const end: Date = getEndOfDay(days[days.length - 1]);

        await onRequestDateRange?.({ start, end });
    }

    async function prependDays(): Promise<void> {
        if (!scrollContainerElement || days.length === 0) {
            return;
        }

        isAdjustingScroll = true;

        const previousScrollLeft: number = scrollContainerElement.scrollLeft;
        const firstDay: Date = days[0];

        const addedDays: Date[] = Array.from(
            { length: daysToAddAtEdge },
            (_: unknown, index: number): Date =>
                addDays(firstDay, -daysToAddAtEdge + index),
        );

        days = [...addedDays, ...days];

        await tick();

        scrollContainerElement.scrollLeft =
            previousScrollLeft + daysToAddAtEdge * dayWidth;
        await requestCurrentDateRange();

        isAdjustingScroll = false;
    }

    async function appendDays(): Promise<void> {
        if (days.length === 0) {
            return;
        }

        const lastDay: Date = days[days.length - 1];

        const addedDays: Date[] = Array.from(
            { length: daysToAddAtEdge },
            (_: unknown, index: number): Date => addDays(lastDay, index + 1),
        );

        days = [...days, ...addedDays];

        await tick();
        await requestCurrentDateRange();
    }

    function reportVisibleDate(): void {
        if (!scrollContainerElement || days.length === 0) {
            return;
        }

        const viewportCenterX: number =
            scrollContainerElement.scrollLeft +
            scrollContainerElement.clientWidth / 2 -
            timeAxisWidthPx;

        const dayIndex: number = Math.max(
            0,
            Math.min(days.length - 1, Math.floor(viewportCenterX / dayWidth)),
        );

        const visibleDate: Date = days[dayIndex];
        const visibleDateKey: string = getDateKey(visibleDate);

        if (visibleDateKey === lastReportedDateKey) {
            return;
        }

        lastReportedDateKey = visibleDateKey;
        onVisibleDateChange?.({ date: visibleDate });
    }

    async function handleWeekScroll(): Promise<void> {
        if (!scrollContainerElement || isAdjustingScroll) {
            return;
        }

        const scrollLeft: number = scrollContainerElement.scrollLeft;
        const maxScrollLeft: number =
            scrollContainerElement.scrollWidth -
            scrollContainerElement.clientWidth;

        reportVisibleDate();

        if (scrollLeft < edgeThresholdPx) {
            await prependDays();
            return;
        }

        if (maxScrollLeft - scrollLeft < edgeThresholdPx) {
            await appendDays();
        }
    }

    async function centerDateInView(targetDate: Date): Promise<void> {
        if (!scrollContainerElement) {
            return;
        }

        await tick();

        const normalizedTargetDate: Date = normalizeDate(targetDate);
        const targetIndex: number = days.findIndex((day: Date): boolean =>
            areSameDay(day, normalizedTargetDate),
        );

        if (targetIndex < 0) {
            return;
        }

        const targetLeft: number =
            timeAxisWidthPx +
            targetIndex * dayWidth -
            scrollContainerElement.clientWidth / 2 +
            dayWidth / 2;

        scrollContainerElement.scrollLeft = Math.max(0, targetLeft);
        reportVisibleDate();
    }

    const headerHeightPx: number = 56;

    function getCurrentMinuteOfDay(): number {
        const now: Date = new Date();

        return now.getHours() * 60 + now.getMinutes();
    }

    async function centerVerticalToCurrentHour(): Promise<void> {
        if (!scrollContainerElement) {
            return;
        }

        await tick();

        await new Promise<void>((resolve: () => void): void => {
            requestAnimationFrame((): void => resolve());
        });

        const containerHeight: number = scrollContainerElement.clientHeight;
        const scrollHeight: number = scrollContainerElement.scrollHeight;

        const currentMinuteOfDay: number = getCurrentMinuteOfDay();
        const currentTimeTopPx: number = (currentMinuteOfDay / 60) * hourHeight;

        const visibleBodyHeight: number = Math.max(
            0,
            containerHeight - headerHeightPx,
        );

        const targetScrollTop: number = Math.max(
            0,
            Math.min(
                scrollHeight - containerHeight,
                currentTimeTopPx - visibleBodyHeight / 2,
            ),
        );

        scrollContainerElement.scrollTop = targetScrollTop;
    }

    onMount((): (() => void) => {
        if (!hasInitialScrollPositioned) {
            hasInitialScrollPositioned = true;

            void (async () => {
                await centerDateInView(date); // X (day)
                await centerVerticalToCurrentHour(); // Y (time)
            })();
        }

        void requestCurrentDateRange();
        const intervalId: number = window.setInterval((): void => {
            now = new Date();
        }, 60_000);

        return (): void => {
            window.clearInterval(intervalId);
        };
    });
</script>

<svelte:window
    onpointermove={handleTaskPointerMove}
    onpointerup={(event: PointerEvent): void => {
        void handleTaskPointerUp(event);
    }}
    onpointercancel={handleTaskPointerCancel}
/>

<div
    class="week-view"
    bind:this={scrollContainerElement}
    onscroll={() => void handleWeekScroll()}
>
    <div
        class="week-grid"
        style={`
			width: ${gridWidthPx}px;
			--time-axis-width: ${timeAxisWidthPx}px;
			--day-width: ${dayWidth}px;
			--header-height: ${headerHeightPx}px;
		`}
    >
        <div
            class="week-header"
            style={`grid-template-columns: var(--time-axis-width) repeat(${days.length}, var(--day-width));`}
        >
            <div class="time-axis-header"></div>

            {#each days as day (getDateKey(day))}
                <div
                    class="day-header"
                    class:today={isToday(day)}
                    class:monday={isMonday(day)}
                >
                    <div class="day-header-weekday">{formatWeekday(day)}</div>
                    <div class="day-header-date">{formatDayMonth(day)}</div>
                </div>
            {/each}
        </div>

        <div class="week-body" style={`height: ${totalDayHeightPx}px;`}>
            <div class="time-axis">
                {#each Array.from({ length: hoursInDay }, (_: unknown, hour: number) => hour) as hour (hour)}
                    <div
                        class="hour-label"
                        class:is-hidden={hour === 0}
                        style={`top: ${hour * hourHeight}px; height: ${hourHeight}px;`}
                    >
                        {formatHourLabel(hour)}
                    </div>
                {/each}
            </div>

            <div
                class="day-columns"
                style={`grid-template-columns: repeat(${days.length}, var(--day-width));`}
            >
                {#each days as day (getDateKey(day))}
                    <div
                        class="day-column"
                        class:today={isToday(day)}
                        class:monday={isMonday(day)}
                        style={`height: ${totalDayHeightPx}px;`}
                        oncontextmenu={(event: MouseEvent): void =>
                            handleEmptySpaceContextMenu(event, day)}
                        role="presentation"
                    >
                        {#each Array.from({ length: hoursInDay }, (_: unknown, hour: number) => hour) as hour (hour)}
                            <div
                                class="hour-line"
                                style={`top: ${hour * hourHeight}px; height: ${hourHeight}px;`}
                            ></div>
                        {/each}

                        {#if isToday(day)}
                            <div
                                class="current-time-indicator"
                                style={`top: ${currentTimeTopPx}px;`}
                                aria-label={`Current time ${formatCurrentTime(now)}`}
                            >
                                <span class="current-time-dot"></span>
                                <span class="current-time-line"></span>
                            </div>
                        {/if}

                        {#each getPositionedTasksForDay(day) as positionedTask (positionedTask.task.id)}
                            <button
                                type="button"
                                class={`task-card task-color-${positionedTask.task.color}`}
                                class:is-dragging={dragState?.task.id ===
                                    positionedTask.task.id}
                                style={`
                                    top: ${positionedTask.top}px;
                                    height: ${positionedTask.height}px;
                                    `}
                                onclick={(event: MouseEvent): void =>
                                    handleTaskClick(event, positionedTask.task)}
                                onpointerdown={(event: PointerEvent): void =>
                                    handleTaskPointerDown(
                                        event,
                                        positionedTask.task,
                                    )}
                                oncontextmenu={(event: MouseEvent): void =>
                                    handleTaskContextMenu(
                                        event,
                                        positionedTask.task,
                                    )}
                            >
                                <div class="task-card-title">
                                    {positionedTask.task.title}
                                </div>
                                <div class="task-card-time">
                                    {formatTimeRange(
                                        getTaskRenderRange(positionedTask.task)
                                            .start,
                                        getTaskRenderRange(positionedTask.task)
                                            .end,
                                    )}
                                </div>
                            </button>
                        {/each}
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .week-view {
        width: 100%;
        height: 100%;
        min-height: 0;
        overflow: auto;
        position: relative;
        background: var(--color-surface);
    }

    .week-grid {
        position: relative;
        min-height: 100%;
    }

    .week-header {
        position: sticky;
        top: 0;
        z-index: 30;
        display: grid;
        height: var(--header-height);
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
    }

    .time-axis-header {
        position: sticky;
        left: 0;
        z-index: 35;
        background: var(--color-surface);
        border-right: 1px solid var(--color-border);
    }

    .day-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        border-right: 1px solid var(--color-border);
        color: var(--color-text);
        user-select: none;
        -webkit-user-select: none;
    }

    .day-header.today {
        background: var(--color-editor-link-bg);
        color: var(--color-accent);
    }

    .day-header-weekday {
        font-size: 0.78rem;
        color: var(--color-text-muted);
    }

    .day-header.today .day-header-weekday {
        color: var(--color-accent);
    }

    .day-header-date {
        font-size: 0.92rem;
        font-weight: 700;
    }

    .week-body {
        position: relative;
        display: grid;
        grid-template-columns: var(--time-axis-width) 1fr;
    }

    .time-axis {
        position: sticky;
        left: 0;
        z-index: 20;
        background: var(--color-surface);
        border-right: 1px solid var(--color-border);
    }

    .hour-label {
        position: absolute;
        left: 0;
        width: var(--time-axis-width);
        padding-right: 0.75rem;
        box-sizing: border-box;
        text-align: right;
        font-size: 0.78rem;
        line-height: 1;
        color: var(--color-text-muted);
        transform: translateY(-0.55rem);
        user-select: none;
        -webkit-user-select: none;
    }

    .hour-label.is-hidden {
        visibility: hidden;
    }

    .day-columns {
        display: grid;
    }

    .day-column {
        position: relative;
        border-right: 1px solid var(--color-border);
        background: var(--color-surface);
    }

    .day-column.today {
        background: color-mix(
            in srgb,
            var(--color-accent) 4%,
            var(--color-surface)
        );
    }

    .hour-line {
        position: absolute;
        left: 0;
        right: 0;
        border-top: 1px solid var(--color-border);
        pointer-events: none;
    }

    .task-card {
        --task-accent: var(--color-accent);
        --task-card-bg: color-mix(in srgb, var(--task-accent) 10%, var(--color-surface) 90%);
        --task-card-border: color-mix(in srgb, var(--task-accent) 35%, var(--color-surface) 65%);

        border: 1px solid var(--task-card-border);
        border-left: 4px solid var(--task-accent);
        background: var(--task-card-bg);


        position: absolute;
        left: 0.35rem;
        right: 0.35rem;
        padding: 0.4rem 0.5rem;
        border-radius: 0.75rem;
        box-shadow: var(--shadow-soft);
        text-align: left;
        overflow: hidden;
        cursor: pointer;
        min-width: 0;
        user-select: none;
        -webkit-user-select: none;
    }

    .task-card:hover {
        box-shadow: var(--shadow-soft-hover);
        transform: translateY(-1px);
    }

    .task-card-title {
        font-size: 0.82rem;
        font-weight: 700;
        line-height: 1.2;
        color: var(--color-title);
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
    }

    .task-card-time {
        margin-top: 0.2rem;
        font-size: 0.7rem;
        line-height: 1.2;
        color: var(--color-text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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

    .current-time-indicator {
        position: absolute;
        left: 0;
        right: 0;
        z-index: 15;
        display: flex;
        align-items: center;
        pointer-events: none;
        transform: translateY(-50%);
    }

    .current-time-dot {
        width: 0.55rem;
        height: 0.55rem;
        margin-left: 0.25rem;
        border-radius: 999px;
        background: var(--color-accent);
        flex: 0 0 auto;
    }

    .current-time-line {
        height: 2px;
        background: var(--color-accent);
        flex: 1 1 auto;
    }

    .task-card.is-dragging {
        z-index: 25;
        opacity: 0.9;
        cursor: grabbing;
        box-shadow: var(--shadow-soft-hover);
    }

    .task-card {
        touch-action: none;
    }
    
    .day-column.monday {
        box-shadow: inset 2px 0 0
            color-mix(in srgb, var(--color-accent) 22%, transparent);
    }

    .day-header.monday {
        box-shadow: inset 2px 0 0
            color-mix(in srgb, var(--color-accent) 22%, transparent);
    }
</style>

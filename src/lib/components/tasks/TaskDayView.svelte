<script lang="ts">
    import { onMount, tick } from "svelte";
    import type { CalendarTask } from "$lib/types/tasks/calendar-task";
    import type { EmptyContextMenuDetail } from "$lib/types/tasks/empty-context-menu-detail";
    import type { TaskContextMenuDetail } from "$lib/types/tasks/task-context-menu-detail";

    let {
        tasks,
        date,
        hourHeight = 72,
        onEmptyContextMenu,
        onTaskContextMenu,
        onRequestDateRollover,
        onTaskClick,
        onTaskMove,
    }: {
        tasks: CalendarTask[];
        date: Date;
        hourHeight?: number;
        onEmptyContextMenu?: (detail: EmptyContextMenuDetail) => void;
        onTaskContextMenu?: (detail: TaskContextMenuDetail) => void;
        onRequestDateRollover?: (detail: { nextDate: Date }) => void;
        onTaskClick?: (task: CalendarTask) => void;
        onTaskMove?: (detail: {
            task: CalendarTask;
            start: Date;
            end: Date;
        }) => void | Promise<void>;
    } = $props();

    type PositionedTask = {
        task: CalendarTask;
        top: number;
        height: number;
        column: number;
        columnCount: number;
    };

    type TaskCluster = {
        taskIndexes: number[];
    };

    type DragPreview = {
        taskId: string;
        start: Date;
        end: Date;
    };

    type DragState = {
        pointerId: number;
        task: CalendarTask;
        startClientY: number;
        originalStart: Date;
        originalEnd: Date;
        taskDurationMinutes: number;
        previewStart: Date;
        previewEnd: Date;
        hasDragStarted: boolean;
        pressTimerId: number | null;
    };

    let scrollContainerElement: HTMLDivElement | null = null;
    let nowIndicatorTimerId: number | null = null;
    let nowTimestamp: number = $state(Date.now());
    let isAutoFollowEnabled: boolean = $state(true);
    let isProgrammaticScrollInProgress: boolean = false;
    let lastBlurAtTimestamp: number | null = null;
    let autoFollowIntervalId: number | null = null;
    let lastKnownTodayKey: string = $state(getDateKey(new Date()));

    let dragState: DragState | null = $state(null);
    let dragPreview: DragPreview | null = $state(null);
    let suppressClickForTaskId: string | null = $state(null);

    let blockedDragPointerId: number | null = null;

    let suppressContextMenuForTaskId: string | null = $state(null);
    let suppressContextMenuTimerId: number | null = null;

    const viewingDateKey: string = $derived(
        `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    );

    const AUTO_FOLLOW_RESTORE_AFTER_MS: number = 30 * 60 * 1000;
    const AUTO_FOLLOW_UPDATE_INTERVAL_MS: number = 30 * 1000;
    const DRAG_HOLD_DELAY_MS: number = 200;
    const DRAG_SNAP_MINUTES: number = 30;

    const hoursInDay: number = 24;
    const minutesInDay: number = 24 * 60;
    const timeAxisWidthPx: number = 52;
    const dayPaddingPx: number = 12;
    const laneGapPx: number = 6;
    const minimumTaskHeightPx: number = 28;
    const nowIndicatorHeightPx: number = 2;

    function handleTaskContextMenu(
        event: MouseEvent,
        task: CalendarTask,
    ): void {
        event.preventDefault();
        event.stopPropagation();

        if (suppressContextMenuForTaskId === task.id) {
            suppressContextMenuForTaskId = null;
            return;
        }

        if (dragState) {
            blockedDragPointerId = dragState.pointerId;
        }

        cancelDrag();

        onTaskContextMenu?.({
            x: event.clientX,
            y: event.clientY,
            task,
        });
    }

    function handleTaskClick(task: CalendarTask): void {
        if (suppressClickForTaskId === task.id) {
            suppressClickForTaskId = null;
            return;
        }

        onTaskClick?.(task);
    }

    function handlePotentialDayRollover(): void {
        if (!isAutoFollowEnabled) {
            return;
        }

        if (!isToday(date)) {
            return;
        }

        const now: Date = new Date(nowTimestamp);
        const currentTodayKey: string = getDateKey(now);

        if (currentTodayKey === lastKnownTodayKey) {
            return;
        }

        lastKnownTodayKey = currentTodayKey;

        const nextDate: Date = getStartOfDay(now);

        onRequestDateRollover?.({
            nextDate,
        });
    }

    function handleEmptySpaceContextMenu(event: MouseEvent): void {
        event.preventDefault();

        const range: { start: Date; end: Date } | null =
            getTimeRangeFromClientY(event.clientY);

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

    function getDateKey(value: Date): string {
        return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
    }

    function getTimeRangeFromClientY(
        clientY: number,
    ): { start: Date; end: Date } | null {
        if (!scrollContainerElement) {
            return null;
        }

        const containerRect: DOMRect =
            scrollContainerElement.getBoundingClientRect();
        const offsetY: number =
            clientY - containerRect.top + scrollContainerElement.scrollTop;

        const clampedOffsetY: number = Math.max(
            0,
            Math.min(totalDayHeightPx, offsetY),
        );
        const minuteOfDay: number = Math.floor(
            (clampedOffsetY / hourHeight) * 60,
        );
        const snappedMinute: number =
            Math.floor(minuteOfDay / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;

        const start: Date = new Date(viewingDayStart);
        start.setMinutes(snappedMinute);

        const end: Date = new Date(start);
        end.setMinutes(start.getMinutes() + DRAG_SNAP_MINUTES);

        return { start, end };
    }

    function handleWindowBlur(): void {
        lastBlurAtTimestamp = Date.now();
    }

    function handleWindowFocus(): void {
        if (lastBlurAtTimestamp === null) {
            return;
        }

        const elapsedMs: number = Date.now() - lastBlurAtTimestamp;

        if (elapsedMs >= AUTO_FOLLOW_RESTORE_AFTER_MS && isToday(date)) {
            isAutoFollowEnabled = true;
            void scrollViewToCurrentTime();
        }

        lastBlurAtTimestamp = null;
    }

    function stopAutoFollowTimer(): void {
        if (autoFollowIntervalId !== null) {
            window.clearInterval(autoFollowIntervalId);
            autoFollowIntervalId = null;
        }
    }

    function startAutoFollowTimer(): void {
        stopAutoFollowTimer();

        if (!isToday(date)) {
            return;
        }

        autoFollowIntervalId = window.setInterval((): void => {
            if (!isAutoFollowEnabled) {
                return;
            }

            void scrollViewToCurrentTime();
        }, AUTO_FOLLOW_UPDATE_INTERVAL_MS);
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

    function minutesSinceDayStart(value: Date, dayStart: Date): number {
        return Math.max(
            0,
            Math.min(
                minutesInDay,
                Math.floor((value.getTime() - dayStart.getTime()) / 60000),
            ),
        );
    }

    function formatHourLabel(hour: number): string {
        return `${hour.toString().padStart(2, "0")}:00`;
    }

    function formatTimeRange(start: Date, end: Date): string {
        const formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat([], {
            hour: "numeric",
            minute: "2-digit",
        });

        return `${formatter.format(start)} – ${formatter.format(end)}`;
    }

    function getDraggedTaskStartMinute(
        clientY: number,
        taskDurationMinutes: number,
    ): number {
        if (!scrollContainerElement) {
            return 0;
        }

        const containerRect: DOMRect =
            scrollContainerElement.getBoundingClientRect();

        const pointerOffsetY: number =
            clientY - containerRect.top + scrollContainerElement.scrollTop;

        const rawMinute: number = Math.round(
            (pointerOffsetY / hourHeight) * 60,
        );
        const snappedMinute: number =
            Math.round(rawMinute / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;

        return Math.max(
            0,
            Math.min(minutesInDay - taskDurationMinutes, snappedMinute),
        );
    }

    function buildDateFromMinuteOfDay(minuteOfDay: number): Date {
        const result: Date = new Date(viewingDayStart);
        result.setMinutes(minuteOfDay);
        return result;
    }

    function clearDragTimer(): void {
        const currentDragState: DragState | null = dragState;

        if (!currentDragState || currentDragState.pressTimerId === null) {
            return;
        }

        window.clearTimeout(currentDragState.pressTimerId);
        currentDragState.pressTimerId = null;
    }

    function cancelDrag(): void {
        clearDragTimer();
        dragState = null;
        dragPreview = null;
    }

    function handleTaskPointerDown(
        event: PointerEvent,
        task: CalendarTask,
    ): void {
        if (event.button !== 0) {
            return;
        }

        const targetElement: HTMLElement | null =
            event.currentTarget instanceof HTMLElement
                ? event.currentTarget
                : null;

        targetElement?.setPointerCapture(event.pointerId);

        const originalStart: Date = toDate(task.start);
        const originalEnd: Date = toDate(task.end);

        const taskDurationMinutes: number = Math.max(
            DRAG_SNAP_MINUTES,
            Math.round(
                (originalEnd.getTime() - originalStart.getTime()) / 60000,
            ),
        );

        const pressTimerId: number = window.setTimeout((): void => {
            if (!dragState || dragState.pointerId !== event.pointerId) {
                return;
            }

            dragState.hasDragStarted = true;
            suppressClickForTaskId = task.id;
        }, DRAG_HOLD_DELAY_MS);

        dragState = {
            pointerId: event.pointerId,
            task,
            startClientY: event.clientY,
            originalStart,
            originalEnd,
            taskDurationMinutes,
            previewStart: originalStart,
            previewEnd: originalEnd,
            hasDragStarted: false,
            pressTimerId,
        };
    }

    function suppressNextContextMenu(taskId: string): void {
        suppressContextMenuForTaskId = taskId;

        if (suppressContextMenuTimerId !== null) {
            window.clearTimeout(suppressContextMenuTimerId);
        }

        suppressContextMenuTimerId = window.setTimeout((): void => {
            suppressContextMenuForTaskId = null;
            suppressContextMenuTimerId = null;
        }, 1000);
    }

    function handleWindowPointerMove(event: PointerEvent): void {
        if (blockedDragPointerId === event.pointerId) {
            return;
        }

        if (!dragState || event.pointerId !== dragState.pointerId) {
            return;
        }

        if (!dragState.hasDragStarted) {
            return;
        }

        event.preventDefault();

        suppressNextContextMenu(dragState.task.id);

        const nextStartMinute: number = getDraggedTaskStartMinute(
            event.clientY,
            dragState.taskDurationMinutes,
        );

        const nextStart: Date = buildDateFromMinuteOfDay(nextStartMinute);
        const nextEnd: Date = new Date(nextStart);

        nextEnd.setMinutes(
            nextEnd.getMinutes() + dragState.taskDurationMinutes,
        );

        dragPreview = {
            taskId: dragState.task.id,
            start: nextStart,
            end: nextEnd,
        };

        dragState.previewStart = nextStart;
        dragState.previewEnd = nextEnd;
    }

    async function handleWindowPointerUp(event: PointerEvent): Promise<void> {
        if (blockedDragPointerId === event.pointerId) {
            blockedDragPointerId = null;
            return;
        }

        if (!dragState || event.pointerId !== dragState.pointerId) {
            return;
        }

        const finishedDragState: DragState = dragState;
        const didDrag: boolean = finishedDragState.hasDragStarted;

        clearDragTimer();
        dragState = null;

        if (!didDrag) {
            dragPreview = null;
            return;
        }

        const nextStart: Date = new Date(finishedDragState.previewStart);
        const nextEnd: Date = new Date(finishedDragState.previewEnd);

        dragPreview = null;

        const didChange: boolean =
            nextStart.getTime() !== finishedDragState.originalStart.getTime() ||
            nextEnd.getTime() !== finishedDragState.originalEnd.getTime();

        if (!didChange) {
            return;
        }

        await onTaskMove?.({
            task: finishedDragState.task,
            start: nextStart,
            end: nextEnd,
        });
    }

    function handleWindowPointerCancel(event: PointerEvent): void {
        if (blockedDragPointerId === event.pointerId) {
            blockedDragPointerId = null;
            return;
        }

        if (!dragState || event.pointerId !== dragState.pointerId) {
            return;
        }

        cancelDrag();
    }

    const viewingDayStart: Date = $derived(getStartOfDay(date));
    const viewingDayEnd: Date = $derived(getEndOfDay(date));
    const totalDayHeightPx: number = $derived(hoursInDay * hourHeight);

    const effectiveTasks: CalendarTask[] = $derived.by((): CalendarTask[] => {
        if (!dragPreview) {
            return tasks;
        }

        return tasks.map((task: CalendarTask): CalendarTask => {
            if (task.id !== dragPreview!.taskId) {
                return task;
            }

            return {
                ...task,
                start: dragPreview!.start,
                end: dragPreview!.end,
            };
        });
    });

    const visibleTasks: CalendarTask[] = $derived.by((): CalendarTask[] => {
        return effectiveTasks.filter((task: CalendarTask): boolean => {
            const taskStart: Date = toDate(task.start);
            const taskEnd: Date = toDate(task.end);

            return (
                taskEnd.getTime() > viewingDayStart.getTime() &&
                taskStart.getTime() < viewingDayEnd.getTime()
            );
        });
    });

    const positionedTasks: PositionedTask[] = $derived.by(
        (): PositionedTask[] => {
            const dayStart: Date = viewingDayStart;

            const sortedEntries: {
                task: CalendarTask;
                startMinute: number;
                endMinute: number;
                originalIndex: number;
            }[] = visibleTasks
                .map(
                    (
                        task: CalendarTask,
                        originalIndex: number,
                    ): {
                        task: CalendarTask;
                        startMinute: number;
                        endMinute: number;
                        originalIndex: number;
                    } => {
                        const rawStart: Date = toDate(task.start);
                        const rawEnd: Date = toDate(task.end);

                        const clampedStartMinute: number = minutesSinceDayStart(
                            rawStart < dayStart ? dayStart : rawStart,
                            dayStart,
                        );

                        const clampedEndMinute: number = minutesSinceDayStart(
                            rawEnd > viewingDayEnd ? viewingDayEnd : rawEnd,
                            dayStart,
                        );

                        return {
                            task,
                            startMinute: clampedStartMinute,
                            endMinute: Math.max(
                                clampedStartMinute + 1,
                                clampedEndMinute,
                            ),
                            originalIndex,
                        };
                    },
                )
                .sort(
                    (
                        left: {
                            startMinute: number;
                            endMinute: number;
                        },
                        right: {
                            startMinute: number;
                            endMinute: number;
                        },
                    ): number => {
                        if (left.startMinute !== right.startMinute) {
                            return left.startMinute - right.startMinute;
                        }

                        return left.endMinute - right.endMinute;
                    },
                );

            const clusters: TaskCluster[] = [];
            let currentCluster: TaskCluster | null = null;
            let currentClusterMaxEndMinute: number = -1;

            for (
                let index: number = 0;
                index < sortedEntries.length;
                index += 1
            ) {
                const entry = sortedEntries[index];

                if (
                    currentCluster === null ||
                    entry.startMinute >= currentClusterMaxEndMinute
                ) {
                    currentCluster = {
                        taskIndexes: [index],
                    };
                    clusters.push(currentCluster);
                    currentClusterMaxEndMinute = entry.endMinute;
                    continue;
                }

                currentCluster.taskIndexes.push(index);
                currentClusterMaxEndMinute = Math.max(
                    currentClusterMaxEndMinute,
                    entry.endMinute,
                );
            }

            const result: PositionedTask[] = [];

            for (const cluster of clusters) {
                const laneEndMinutes: number[] = [];
                const entryLaneIndexes: number[] = new Array(
                    cluster.taskIndexes.length,
                );

                for (
                    let clusterIndex: number = 0;
                    clusterIndex < cluster.taskIndexes.length;
                    clusterIndex += 1
                ) {
                    const entryIndex: number =
                        cluster.taskIndexes[clusterIndex];
                    const entry = sortedEntries[entryIndex];

                    let assignedLaneIndex: number = -1;

                    for (
                        let laneIndex: number = 0;
                        laneIndex < laneEndMinutes.length;
                        laneIndex += 1
                    ) {
                        if (entry.startMinute >= laneEndMinutes[laneIndex]) {
                            assignedLaneIndex = laneIndex;
                            laneEndMinutes[laneIndex] = entry.endMinute;
                            break;
                        }
                    }

                    if (assignedLaneIndex === -1) {
                        assignedLaneIndex = laneEndMinutes.length;
                        laneEndMinutes.push(entry.endMinute);
                    }

                    entryLaneIndexes[clusterIndex] = assignedLaneIndex;
                }

                const clusterColumnCount: number = laneEndMinutes.length;

                for (
                    let clusterIndex: number = 0;
                    clusterIndex < cluster.taskIndexes.length;
                    clusterIndex += 1
                ) {
                    const entryIndex: number =
                        cluster.taskIndexes[clusterIndex];
                    const entry = sortedEntries[entryIndex];

                    const top: number = (entry.startMinute / 60) * hourHeight;

                    const height: number = Math.max(
                        minimumTaskHeightPx,
                        ((entry.endMinute - entry.startMinute) / 60) *
                            hourHeight,
                    );

                    result.push({
                        task: entry.task,
                        top,
                        height,
                        column: entryLaneIndexes[clusterIndex],
                        columnCount: clusterColumnCount,
                    });
                }
            }

            return result;
        },
    );

    const currentTimeTopPx: number = $derived.by((): number => {
        if (!isToday(date)) {
            return 0;
        }

        const now: Date = new Date(nowTimestamp);
        const minutes: number = now.getHours() * 60 + now.getMinutes();

        const rawTopPx: number = (minutes / 60) * hourHeight;

        return Math.max(
            0,
            Math.min(totalDayHeightPx - nowIndicatorHeightPx, rawTopPx),
        );
    });

    function handleDayViewScroll(): void {
        if (isProgrammaticScrollInProgress) {
            return;
        }

        isAutoFollowEnabled = false;
    }

    async function scrollViewToCurrentTime(): Promise<void> {
        if (!scrollContainerElement || !isToday(date)) {
            return;
        }

        await tick();

        await new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => resolve());
        });

        const containerHeight: number = scrollContainerElement.clientHeight;
        const scrollHeight: number = scrollContainerElement.scrollHeight;
        const maxScrollTop: number = Math.max(
            0,
            scrollHeight - containerHeight,
        );

        const targetScrollTop: number = Math.max(
            0,
            Math.min(maxScrollTop, currentTimeTopPx - containerHeight / 2),
        );

        isProgrammaticScrollInProgress = true;
        scrollContainerElement.scrollTop = targetScrollTop;

        window.setTimeout((): void => {
            isProgrammaticScrollInProgress = false;
        }, 100);
    }

    function handleWindowPointerUpEvent(event: Event): void {
        void handleWindowPointerUp(event as PointerEvent);
    }

    $effect((): void | (() => void) => {
        if (!isToday(date)) {
            return;
        }

        const updateNow = (): void => {
            nowTimestamp = Date.now();
            handlePotentialDayRollover();
        };

        updateNow();

        if (nowIndicatorTimerId !== null) {
            window.clearInterval(nowIndicatorTimerId);
        }

        nowIndicatorTimerId = window.setInterval((): void => {
            updateNow();
        }, AUTO_FOLLOW_UPDATE_INTERVAL_MS);

        return (): void => {
            if (nowIndicatorTimerId !== null) {
                window.clearInterval(nowIndicatorTimerId);
                nowIndicatorTimerId = null;
            }
        };
    });

    $effect((): void => {
        viewingDateKey;
        lastKnownTodayKey = getDateKey(new Date());

        if (isToday(date)) {
            isAutoFollowEnabled = true;
            startAutoFollowTimer();
            return;
        }

        isAutoFollowEnabled = false;
        stopAutoFollowTimer();
    });

    onMount((): (() => void) => {
        void scrollViewToCurrentTime();
        startAutoFollowTimer();

        window.addEventListener("blur", handleWindowBlur);
        window.addEventListener("focus", handleWindowFocus);
        window.addEventListener("pointermove", handleWindowPointerMove, {
            passive: false,
        });
        window.addEventListener("pointerup", handleWindowPointerUpEvent);
        window.addEventListener("pointercancel", handleWindowPointerCancel);

        return (): void => {
            stopAutoFollowTimer();
            cancelDrag();

            window.removeEventListener("blur", handleWindowBlur);
            window.removeEventListener("focus", handleWindowFocus);
            window.removeEventListener("pointermove", handleWindowPointerMove);
            window.removeEventListener("pointerup", handleWindowPointerUpEvent);
            window.removeEventListener(
                "pointercancel",
                handleWindowPointerCancel,
            );
        };
    });
</script>

<div
    class="day-view"
    bind:this={scrollContainerElement}
    onscroll={handleDayViewScroll}
>
    <div
        class="day-grid"
        style={`height: ${totalDayHeightPx}px; --time-axis-width: ${timeAxisWidthPx}px;`}
    >
        {#each Array.from({ length: hoursInDay }, (_, hour: number) => hour) as hour (hour)}
            <div
                class="hour-row"
                style={`top: ${hour * hourHeight}px; height: ${hourHeight}px;`}
            >
                <div class="hour-label" class:is-hidden={hour === 0}>
                    {formatHourLabel(hour)}
                </div>
                <div class="hour-line"></div>
            </div>
        {/each}

        <div
            class="all-day-column"
            role="dialog"
            tabindex="-1"
            oncontextmenu={handleEmptySpaceContextMenu}
        >
            {#each positionedTasks as positionedTask (positionedTask.task.id)}
                <button
                    type="button"
                    class={`task-card task-color-${positionedTask.task.color} ${dragPreview?.taskId === positionedTask.task.id ? "is-dragging" : ""}`}
                    oncontextmenu={(event: MouseEvent): void =>
                        handleTaskContextMenu(event, positionedTask.task)}
                    onclick={() => handleTaskClick(positionedTask.task)}
                    onpointerdown={(event: PointerEvent): void =>
                        handleTaskPointerDown(event, positionedTask.task)}
                    style={`
                        top: ${positionedTask.top}px;
                        height: ${positionedTask.height}px;
                        left: calc(
                            var(--time-axis-width) + ${dayPaddingPx}px +
                            ${positionedTask.column} * (
                                (100% - var(--time-axis-width) - ${dayPaddingPx * 2}px - ${(positionedTask.columnCount - 1) * laneGapPx}px) / ${positionedTask.columnCount}
                                + ${laneGapPx}px
                            )
                        );
                        width: calc(
                            (100% - var(--time-axis-width) - ${dayPaddingPx * 2}px - ${(positionedTask.columnCount - 1) * laneGapPx}px) / ${positionedTask.columnCount}
                        );
                    `}
                    title={`${positionedTask.task.title} • ${formatTimeRange(
                        toDate(positionedTask.task.start),
                        toDate(positionedTask.task.end),
                    )}`}
                >
                    <div class="task-card-title">
                        {positionedTask.task.title}
                    </div>
                    <div class="task-card-time">
                        {formatTimeRange(
                            toDate(positionedTask.task.start),
                            toDate(positionedTask.task.end),
                        )}
                    </div>
                </button>
            {/each}

            {#if isToday(date)}
                <div
                    class="now-line"
                    style={`top: ${currentTimeTopPx}px; left: calc(var(--time-axis-width) + ${dayPaddingPx}px);`}
                    aria-hidden="true"
                >
                    <span class="now-dot"></span>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .day-view {
        width: 100%;
        height: 100%;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        position: relative;
        background: var(--color-surface);
    }

    .day-grid {
        position: relative;
        width: 100%;
        min-width: 0;
    }

    .hour-row {
        position: absolute;
        left: 0;
        right: 0;
        display: grid;
        grid-template-columns: var(--time-axis-width) minmax(0, 1fr);
        pointer-events: none;
    }

    .hour-label {
        position: relative;
        top: -0.55rem;
        padding-right: 0.75rem;
        text-align: right;
        font-size: 0.78rem;
        line-height: 1;
        color: var(--color-text-muted);
        user-select: none;
    }

    .hour-line {
        border-top: 1px solid var(--color-border);
    }

    .all-day-column {
        position: absolute;
        inset: 0;
        overflow: hidden;
    }

    .task-card {
        --task-accent: var(--color-accent);
        --task-card-bg: color-mix(in srgb, var(--task-accent) 10%, var(--color-surface) 90%);
        --task-card-border: color-mix(in srgb, var(--task-accent) 35%, var(--color-surface) 65%);

        border: 1px solid var(--task-card-border);
        border-left: 4px solid var(--task-accent);
        background: var(--task-card-bg);
        
        position: absolute;
        padding: 0.45rem 0.55rem;
        border-radius: 0.75rem;
        box-shadow: var(--shadow-soft);
        text-align: left;
        overflow: hidden;
        cursor: pointer;
        min-width: 0;
        touch-action: none;
        user-select: none;
    }

    .task-card.is-dragging {
        z-index: 10;
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

    .task-card:hover {
        box-shadow: var(--shadow-soft-hover);
        transform: translateY(-1px);
    }

    .task-card-title {
        font-size: 0.86rem;
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
        font-size: 0.73rem;
        line-height: 1.2;
        color: var(--color-text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .now-line {
        position: absolute;
        right: 0;
        height: 2px;
        background: var(--color-accent);
        z-index: 5;
        pointer-events: none;
    }

    .now-dot {
        position: absolute;
        left: -0.38rem;
        top: 50%;
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 999px;
        background: var(--color-accent);
        transform: translateY(-50%);
        box-shadow: 0 0 0 2px var(--color-surface);
    }

    .hour-label.is-hidden {
        visibility: hidden;
    }
</style>

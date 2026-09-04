<script lang="ts">
    import { onMount, tick } from "svelte";
    import type { DayPlanItem } from "$lib/types/dayplanner/day-plan-item";
    import {
        createDayPlanItem,
        deleteDayPlanItem,
        getDayPlanItemsForDay,
        upsertDayPlanItem,
    } from "$lib/services/day-plan-items-service";
    import type { DayPlanItemDraft } from "$lib/types/dayplanner/day-plan-item-draft";
    import DayPlanItemDialog from "./DayPlanItemDialog.svelte";
    import type { CalendarTask } from "$lib/types/tasks/calendar-task";
    import { getCalendarTasksBetweenDates } from "$lib/services/calendar-task-service";

    type PositionedItem = {
        item: DayPlanItem;
        top: number;
        height: number;
        column: number;
        columnCount: number;
    };

    type ItemCluster = {
        itemIndexes: number[];
    };

    type DragPreview = {
        itemId: string;
        start: Date;
        end: Date;
    };

    type DragState = {
        pointerId: number;
        item: DayPlanItem;
        originalStart: Date;
        originalEnd: Date;
        itemDurationMinutes: number;
        previewStart: Date;
        previewEnd: Date;
        hasDragStarted: boolean;
        pressTimerId: number | null;
    };

    type ContextMenuState = {
        x: number;
        y: number;
        item: DayPlanItem | null;
        start: Date | null;
        end: Date | null;
    };

    type DialogMode = "create" | "update";

    type DayPlanItemDialogState = {
        isOpen: boolean;
        mode: DialogMode;
        item: DayPlanItem | null;
        initialStartDate: Date | null;
    };

    let date: Date = $state(getStartOfDay(new Date()));
    let items: DayPlanItem[] = $state([]);
    let isLoading: boolean = $state(false);
    let loadError: string | null = $state(null);

    let scrollContainerElement: HTMLDivElement | null = null;
    let nowTimestamp: number = $state(Date.now());
    let nowIndicatorTimerId: number | null = null;
    let autoFollowIntervalId: number | null = null;
    let isAutoFollowEnabled: boolean = $state(true);
    let isProgrammaticScrollInProgress: boolean = false;
    let lastBlurAtTimestamp: number | null = null;
    let lastKnownTodayKey: string = $state(getDateKey(new Date()));

    let dragState: DragState | null = $state(null);
    let dragPreview: DragPreview | null = $state(null);
    let suppressClickForItemId: string | null = $state(null);

    let contextMenu: ContextMenuState | null = $state(null);

    let dialog: DayPlanItemDialogState = $state({
        isOpen: false,
        mode: "create",
        item: null,
        initialStartDate: null,
    });

    const hourHeight: number = 72;
    const hoursInDay: number = 24;
    const minutesInDay: number = 24 * 60;
    const timeAxisWidthPx: number = 52;
    const dayPaddingPx: number = 12;
    const laneGapPx: number = 6;
    const minimumItemHeightPx: number = 28;
    const nowIndicatorHeightPx: number = 2;

    const AUTO_FOLLOW_RESTORE_AFTER_MS: number = 30 * 60 * 1000;
    const AUTO_FOLLOW_UPDATE_INTERVAL_MS: number = 30 * 1000;
    const DRAG_HOLD_DELAY_MS: number = 200;
    const DRAG_SNAP_MINUTES: number = 30;

    const viewingDayStart: Date = $derived(getStartOfDay(date));
    const viewingDayEnd: Date = $derived(getEndOfDay(date));
    const totalDayHeightPx: number = $derived(hoursInDay * hourHeight);

    function toDate(value: string | Date): Date {
        return value instanceof Date ? value : new Date(value);
    }

    function getDateKey(value: Date): string {
        return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
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

    function formatDateInputValue(value: Date): string {
        const year: string = value.getFullYear().toString();
        const month: string = (value.getMonth() + 1)
            .toString()
            .padStart(2, "0");
        const day: string = value.getDate().toString().padStart(2, "0");
        const hours: string = value.getHours().toString().padStart(2, "0");
        const minutes: string = value.getMinutes().toString().padStart(2, "0");

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    function parseDateInputValue(value: string): Date {
        return new Date(value);
    }

    let loadVersion: number = 0;
    async function loadItems(): Promise<void> {
        const currentLoadVersion: number = loadVersion + 1;
        loadVersion = currentLoadVersion;

        const loadDate: Date = new Date(date);
        const loadDayStart: Date = getStartOfDay(loadDate);
        const loadDayEnd: Date = getEndOfDay(loadDate);

        isLoading = true;
        loadError = null;

        try {
            const loadedItems: DayPlanItem[] =
                await getDayPlanItemsForDay(loadDate);

            if (currentLoadVersion !== loadVersion) {
                return;
            }

            if (loadedItems.length > 0) {
                items = loadedItems;
                return;
            }

            const tasksForDay: CalendarTask[] =
                await getCalendarTasksBetweenDates(loadDayStart, loadDayEnd);

            if (currentLoadVersion !== loadVersion) {
                return;
            }

            if (tasksForDay.length === 0) {
                items = [];
                return;
            }

            const createdItems: DayPlanItem[] = [];

            for (const task of tasksForDay) {
                const createdItem: DayPlanItem = await createDayPlanItem({
                    title: task.title,
                    color: task.color,
                    start: toDate(task.start),
                    end: toDate(task.end),
                });

                createdItems.push(createdItem);
            }

            if (currentLoadVersion !== loadVersion) {
                return;
            }

            items = createdItems;
        } catch (error) {
            if (currentLoadVersion === loadVersion) {
                loadError =
                    error instanceof Error ? error.message : String(error);
            }
        } finally {
            if (currentLoadVersion === loadVersion) {
                isLoading = false;
            }
        }
    }

    function closeContextMenu(): void {
        contextMenu = null;
    }

    function openEmptyContextMenu(event: MouseEvent): void {
        event.preventDefault();

        const range: { start: Date; end: Date } | null =
            getTimeRangeFromClientY(event.clientY);

        if (!range) {
            return;
        }

        contextMenu = {
            x: event.clientX,
            y: event.clientY,
            item: null,
            start: range.start,
            end: range.end,
        };
    }

    let blockedDragPointerId: number | null = null;
    function openItemContextMenu(event: MouseEvent, item: DayPlanItem): void {
        event.preventDefault();
        event.stopPropagation();

        if (suppressContextMenuForItemId === item.id) {
            suppressContextMenuForItemId = null;
            return;
        }

        if (dragState) {
            blockedDragPointerId = dragState.pointerId;
        }

        cancelDrag();

        contextMenu = {
            x: event.clientX,
            y: event.clientY,
            item,
            start: null,
            end: null,
        };
    }
    function openCreateDialog(start: Date): void {
        closeContextMenu();

        dialog = {
            isOpen: true,
            mode: "create",
            item: null,
            initialStartDate: start,
        };
    }

    function openEditDialog(item: DayPlanItem): void {
        closeContextMenu();

        dialog = {
            isOpen: true,
            mode: "update",
            item,
            initialStartDate: null,
        };
    }

    function closeDialog(): void {
        dialog.isOpen = false;
    }

    async function handleDialogSubmit(draft: DayPlanItemDraft): Promise<void> {
        if (dialog.mode === "update" && dialog.item) {
            const updatedItem: DayPlanItem = {
                ...dialog.item,
                title: draft.title,
                color: draft.color,
                start: draft.start,
                end: draft.end,
            };

            const savedItem: DayPlanItem = await upsertDayPlanItem(updatedItem);

            items = items.map((item: DayPlanItem): DayPlanItem => {
                if (item.id !== savedItem.id) {
                    return item;
                }

                return savedItem;
            });

            closeDialog();
            return;
        }

        const createdItem: DayPlanItem = await createDayPlanItem({
            title: draft.title,
            color: draft.color,
            start: draft.start,
            end: draft.end,
        });

        items = [...items, createdItem];

        closeDialog();
    }

    async function handleDialogDelete(): Promise<void> {
        if (!dialog.item) {
            return;
        }

        await deleteDayPlanItem(dialog.item.id);

        items = items.filter((item: DayPlanItem): boolean => {
            return item.id !== dialog.item?.id;
        });

        closeDialog();
    }

    async function removeItem(item: DayPlanItem): Promise<void> {
        closeContextMenu();

        await deleteDayPlanItem(item.id);

        items = items.filter((currentItem: DayPlanItem): boolean => {
            return currentItem.id !== item.id;
        });
    }

    function handleItemClick(item: DayPlanItem): void {
        if (suppressClickForItemId === item.id) {
            suppressClickForItemId = null;
            return;
        }

        openEditDialog(item);
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

    function getDraggedItemStartMinute(
        clientY: number,
        itemDurationMinutes: number,
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
            Math.min(minutesInDay - itemDurationMinutes, snappedMinute),
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

    function handleItemPointerDown(
        event: PointerEvent,
        item: DayPlanItem,
    ): void {
        if (contextMenu) {
            return;
        }

        if (event.button !== 0) {
            return;
        }

        const targetElement: HTMLElement | null =
            event.currentTarget instanceof HTMLElement
                ? event.currentTarget
                : null;

        targetElement?.setPointerCapture(event.pointerId);

        const originalStart: Date = toDate(item.start);
        const originalEnd: Date = toDate(item.end);

        const itemDurationMinutes: number = Math.max(
            DRAG_SNAP_MINUTES,
            Math.round(
                (originalEnd.getTime() - originalStart.getTime()) / 60000,
            ),
        );

        const pressTimerId: number = window.setTimeout((): void => {
            if (!dragState || dragState.pointerId !== event.pointerId) {
                return;
            }

            closeContextMenu();

            dragState.hasDragStarted = true;
            suppressClickForItemId = item.id;
        }, DRAG_HOLD_DELAY_MS);

        dragState = {
            pointerId: event.pointerId,
            item,
            originalStart,
            originalEnd,
            itemDurationMinutes,
            previewStart: originalStart,
            previewEnd: originalEnd,
            hasDragStarted: false,
            pressTimerId,
        };
    }

    let suppressContextMenuForItemId: string | null = $state(null);
    let suppressContextMenuTimerId: number | null = null;

    function suppressNextContextMenu(itemId: string): void {
        suppressContextMenuForItemId = itemId;

        if (suppressContextMenuTimerId !== null) {
            window.clearTimeout(suppressContextMenuTimerId);
        }

        suppressContextMenuTimerId = window.setTimeout((): void => {
            suppressContextMenuForItemId = null;
            suppressContextMenuTimerId = null;
        }, 1000);
    }

    function handleWindowPointerMove(event: PointerEvent): void {
        if (blockedDragPointerId === event.pointerId) {
            return;
        }

        if (contextMenu) {
            cancelDrag();
            return;
        }

        if (!dragState || event.pointerId !== dragState.pointerId) {
            return;
        }

        if (!dragState.hasDragStarted) {
            return;
        }

        event.preventDefault();

        suppressNextContextMenu(dragState.item.id);

        const nextStartMinute: number = getDraggedItemStartMinute(
            event.clientY,
            dragState.itemDurationMinutes,
        );

        const nextStart: Date = buildDateFromMinuteOfDay(nextStartMinute);
        const nextEnd: Date = new Date(nextStart);

        nextEnd.setMinutes(
            nextEnd.getMinutes() + dragState.itemDurationMinutes,
        );

        dragPreview = {
            itemId: dragState.item.id,
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

        const movedItem: DayPlanItem = {
            ...finishedDragState.item,
            start: nextStart,
            end: nextEnd,
        };

        const savedItem: DayPlanItem = await upsertDayPlanItem(movedItem);

        items = items.map((item: DayPlanItem): DayPlanItem => {
            if (item.id !== savedItem.id) {
                return item;
            }

            return savedItem;
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

    function handleWindowPointerUpEvent(event: Event): void {
        void handleWindowPointerUp(event as PointerEvent);
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
        date = getStartOfDay(now);

        void loadItems();
    }

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

        const currentTimeTopPxValue: number = currentTimeTopPx;

        const targetScrollTop: number = Math.max(
            0,
            Math.min(maxScrollTop, currentTimeTopPxValue - containerHeight / 2),
        );

        isProgrammaticScrollInProgress = true;
        scrollContainerElement.scrollTop = targetScrollTop;

        window.setTimeout((): void => {
            isProgrammaticScrollInProgress = false;
        }, 100);
    }

    const effectiveItems: DayPlanItem[] = $derived.by((): DayPlanItem[] => {
        if (!dragPreview) {
            return items;
        }

        return items.map((item: DayPlanItem): DayPlanItem => {
            if (item.id !== dragPreview!.itemId) {
                return item;
            }

            return {
                ...item,
                start: dragPreview!.start,
                end: dragPreview!.end,
            };
        });
    });

    const visibleItems: DayPlanItem[] = $derived.by((): DayPlanItem[] => {
        return effectiveItems.filter((item: DayPlanItem): boolean => {
            const itemStart: Date = toDate(item.start);
            const itemEnd: Date = toDate(item.end);

            return (
                itemEnd.getTime() > viewingDayStart.getTime() &&
                itemStart.getTime() < viewingDayEnd.getTime()
            );
        });
    });

    const positionedItems: PositionedItem[] = $derived.by(
        (): PositionedItem[] => {
            const sortedEntries: {
                item: DayPlanItem;
                startMinute: number;
                endMinute: number;
            }[] = visibleItems
                .map(
                    (
                        item: DayPlanItem,
                    ): {
                        item: DayPlanItem;
                        startMinute: number;
                        endMinute: number;
                    } => {
                        const rawStart: Date = toDate(item.start);
                        const rawEnd: Date = toDate(item.end);

                        const clampedStartMinute: number = minutesSinceDayStart(
                            rawStart < viewingDayStart
                                ? viewingDayStart
                                : rawStart,
                            viewingDayStart,
                        );

                        const clampedEndMinute: number = minutesSinceDayStart(
                            rawEnd > viewingDayEnd ? viewingDayEnd : rawEnd,
                            viewingDayStart,
                        );

                        return {
                            item,
                            startMinute: clampedStartMinute,
                            endMinute: Math.max(
                                clampedStartMinute + 1,
                                clampedEndMinute,
                            ),
                        };
                    },
                )
                .sort(
                    (
                        left: { startMinute: number; endMinute: number },
                        right: { startMinute: number; endMinute: number },
                    ): number => {
                        if (left.startMinute !== right.startMinute) {
                            return left.startMinute - right.startMinute;
                        }

                        return left.endMinute - right.endMinute;
                    },
                );

            const clusters: ItemCluster[] = [];
            let currentCluster: ItemCluster | null = null;
            let currentClusterMaxEndMinute: number = -1;

            for (
                let index: number = 0;
                index < sortedEntries.length;
                index += 1
            ) {
                const entry: {
                    item: DayPlanItem;
                    startMinute: number;
                    endMinute: number;
                } = sortedEntries[index];

                if (
                    currentCluster === null ||
                    entry.startMinute >= currentClusterMaxEndMinute
                ) {
                    currentCluster = {
                        itemIndexes: [index],
                    };

                    clusters.push(currentCluster);
                    currentClusterMaxEndMinute = entry.endMinute;
                    continue;
                }

                currentCluster.itemIndexes.push(index);
                currentClusterMaxEndMinute = Math.max(
                    currentClusterMaxEndMinute,
                    entry.endMinute,
                );
            }

            const result: PositionedItem[] = [];

            for (const cluster of clusters) {
                const laneEndMinutes: number[] = [];
                const entryLaneIndexes: number[] = new Array(
                    cluster.itemIndexes.length,
                );

                for (
                    let clusterIndex: number = 0;
                    clusterIndex < cluster.itemIndexes.length;
                    clusterIndex += 1
                ) {
                    const entryIndex: number =
                        cluster.itemIndexes[clusterIndex];

                    const entry: {
                        item: DayPlanItem;
                        startMinute: number;
                        endMinute: number;
                    } = sortedEntries[entryIndex];

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
                    clusterIndex < cluster.itemIndexes.length;
                    clusterIndex += 1
                ) {
                    const entryIndex: number =
                        cluster.itemIndexes[clusterIndex];

                    const entry: {
                        item: DayPlanItem;
                        startMinute: number;
                        endMinute: number;
                    } = sortedEntries[entryIndex];

                    const top: number = (entry.startMinute / 60) * hourHeight;

                    const height: number = Math.max(
                        minimumItemHeightPx,
                        ((entry.endMinute - entry.startMinute) / 60) *
                            hourHeight,
                    );

                    result.push({
                        item: entry.item,
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

    $effect((): void => {
        getDateKey(date);
        void loadItems();
    });

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
        getDateKey(date);
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
        window.addEventListener("click", closeContextMenu);
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
            window.removeEventListener("click", closeContextMenu);
            window.removeEventListener("pointermove", handleWindowPointerMove);
            window.removeEventListener("pointerup", handleWindowPointerUpEvent);
            window.removeEventListener(
                "pointercancel",
                handleWindowPointerCancel,
            );
        };
    });

    function toLocalDayPlanItemDraft(
        task: CalendarTask,
    ): Omit<DayPlanItem, "id"> {
        return {
            title: task.title,
            color: task.color,
            start: toDate(task.start),
            end: toDate(task.end),
        };
    }
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
            oncontextmenu={openEmptyContextMenu}
        >
            {#each positionedItems as positionedItem (positionedItem.item.id)}
                <button
                    type="button"
                    class={`plan-card task-color-${positionedItem.item.color} ${dragPreview?.itemId === positionedItem.item.id ? "is-dragging" : ""}`}
                    style={`
                        top: ${positionedItem.top}px;
                        height: ${positionedItem.height}px;
                        left: calc(
                            var(--time-axis-width) + ${dayPaddingPx}px +
                            ${positionedItem.column} * (
                                (100% - var(--time-axis-width) - ${dayPaddingPx * 2}px - ${(positionedItem.columnCount - 1) * laneGapPx}px) / ${positionedItem.columnCount}
                                + ${laneGapPx}px
                            )
                        );
                        width: calc(
                            (100% - var(--time-axis-width) - ${dayPaddingPx * 2}px - ${(positionedItem.columnCount - 1) * laneGapPx}px) / ${positionedItem.columnCount}
                        );
                    `}
                    title={`${positionedItem.item.title ?? "Untitled plan"} • ${formatTimeRange(
                        toDate(positionedItem.item.start),
                        toDate(positionedItem.item.end),
                    )}`}
                    oncontextmenu={(event: MouseEvent): void =>
                        openItemContextMenu(event, positionedItem.item)}
                    onclick={() => handleItemClick(positionedItem.item)}
                    onpointerdown={(event: PointerEvent): void =>
                        handleItemPointerDown(event, positionedItem.item)}
                >
                    <div class="plan-card-title">
                        {positionedItem.item.title || "Untitled plan"}
                    </div>

                    <div class="plan-card-time">
                        {formatTimeRange(
                            toDate(positionedItem.item.start),
                            toDate(positionedItem.item.end),
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

    {#if isLoading}
        <div class="status-message">Loading...</div>
    {/if}

    {#if loadError}
        <div class="status-message error-message">{loadError}</div>
    {/if}
</div>

{#if contextMenu}
    <div
        class="context-menu"
        style={`left: ${contextMenu.x}px; top: ${contextMenu.y}px;`}
        oncontextmenu={(event: MouseEvent): void => event.preventDefault()}
        role="menu"
        tabindex="-1"
    >
        {#if contextMenu.item}
            <button
                type="button"
                role="menuitem"
                onclick={() => openEditDialog(contextMenu!.item!)}
            >
                Edit
            </button>

            <button
                type="button"
                role="menuitem"
                class="danger"
                onclick={() => void removeItem(contextMenu!.item!)}
            >
                Delete
            </button>
        {:else if contextMenu.start && contextMenu.end}
            <button
                type="button"
                role="menuitem"
                onclick={() => openCreateDialog(contextMenu!.start!)}
            >
                Create plan item
            </button>
        {/if}
    </div>
{/if}

<DayPlanItemDialog
    isOpen={dialog.isOpen}
    mode={dialog.mode}
    initialItem={dialog.item}
    initialStartDate={dialog.initialStartDate}
    onClose={closeDialog}
    onSubmit={handleDialogSubmit}
    onDelete={handleDialogDelete}
/>

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

    .hour-label.is-hidden {
        visibility: hidden;
    }

    .hour-line {
        border-top: 1px solid var(--color-border);
    }

    .all-day-column {
        position: absolute;
        inset: 0;
        overflow: hidden;
    }

    .plan-card {
        --plan-accent: var(--color-accent);
        --plan-card-bg: color-mix(
            in srgb,
            var(--plan-accent) 10%,
            var(--color-surface) 90%
        );
        --plan-card-border: color-mix(
            in srgb,
            var(--plan-accent) 35%,
            var(--color-surface) 65%
        );

        position: absolute;
        min-width: 0;
        overflow: hidden;
        padding: 0.45rem 0.55rem;
        border: 1px solid var(--plan-card-border);
        border-left: 4px solid var(--plan-accent);
        border-radius: 0.75rem;
        background: var(--plan-card-bg);
        box-shadow: var(--shadow-soft);
        text-align: left;
        cursor: pointer;
        touch-action: none;
        user-select: none;
    }

    .plan-card:hover {
        box-shadow: var(--shadow-soft-hover);
        transform: translateY(-1px);
    }

    .plan-card.is-dragging {
        z-index: 10;
        cursor: grabbing;
        box-shadow: var(--shadow-soft-hover);
    }

    .plan-card-title {
        color: var(--color-title);
        font-size: 0.86rem;
        font-weight: 700;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
    }

    .plan-card-time {
        margin-top: 0.2rem;
        color: var(--color-text-muted);
        font-size: 0.73rem;
        line-height: 1.2;
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

    .status-message {
        position: sticky;
        bottom: 0.75rem;
        margin: 0.75rem;
        padding: 0.55rem 0.75rem;
        border-radius: 0.75rem;
        background: var(--color-surface);
        box-shadow: var(--shadow-soft);
        color: var(--color-text-muted);
        font-size: 0.85rem;
    }

    .error-message {
        color: var(--color-task-red);
    }

    .context-menu {
        position: fixed;
        z-index: 100;
        min-width: 11rem;
        padding: 0.35rem;
        border: 1px solid var(--color-border);
        border-radius: 0.8rem;
        background: var(--color-surface);
        box-shadow: var(--shadow-soft-hover);
    }

    .context-menu button {
        display: block;
        width: 100%;
        padding: 0.55rem 0.7rem;
        border: 0;
        border-radius: 0.55rem;
        background: transparent;
        color: var(--color-text);
        text-align: left;
        cursor: pointer;
    }

    .context-menu button:hover {
        background: color-mix(
            in srgb,
            var(--color-accent) 10%,
            transparent 90%
        );
    }

    .context-menu button.danger {
        color: var(--color-task-red);
    }

    .task-color-1 {
        --plan-accent: var(--color-task-primary);
    }

    .task-color-2 {
        --plan-accent: var(--color-task-red);
    }

    .task-color-3 {
        --plan-accent: var(--color-task-rose);
    }

    .task-color-4 {
        --plan-accent: var(--color-task-blue);
    }

    .task-color-5 {
        --plan-accent: var(--color-task-blue-light);
    }

    .task-color-6 {
        --plan-accent: var(--color-task-green);
    }

    .task-color-7 {
        --plan-accent: var(--color-task-green-light);
    }

    .task-color-8 {
        --plan-accent: var(--color-task-yellow);
    }

    .task-color-9 {
        --plan-accent: var(--color-task-orange);
    }

    .task-color-10 {
        --plan-accent: var(--color-task-purple);
    }

    .task-color-11 {
        --plan-accent: var(--color-task-lavender);
    }

    .task-color-12 {
        --plan-accent: var(--color-task-gray);
    }

    .task-color-13 {
        --plan-accent: var(--color-task-brown);
    }
</style>

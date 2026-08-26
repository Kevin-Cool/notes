<script lang="ts">
    import { onMount } from "svelte";

    import TaskContextMenu from "$lib/components/tasks/TaskContextMenu.svelte";
    import TaskDatePickerPopup from "$lib/components/tasks/TaskDatePickerPopup.svelte";
    import TaskDialog from "$lib/components/tasks/TaskDialog.svelte";
    import TaskPageToolbar from "$lib/components/tasks/TaskPageToolbar.svelte";
    import TaskViewRenderer from "$lib/components/tasks/TaskViewRenderer.svelte";
    import TaskWeekView from "$lib/components/tasks/TaskWeekView.svelte";

    import {
        createCalendarTask,
        deleteCalendarTask,
        getCalendarTasksBetweenDates,
        upsertCalendarTask,
    } from "$lib/services/calendar-task-service";

    import type { CalendarTask } from "$lib/types/tasks/calendar-task";
    import type { CalendarTaskDraft } from "$lib/types/tasks/calendar-task-draft";
    import type { CalendarView } from "$lib/types/tasks/calendar-view";
    import type { EmptyContextMenuDetail } from "$lib/types/tasks/empty-context-menu-detail";
    import type { TaskContextMenuDetail } from "$lib/types/tasks/task-context-menu-detail";
    import type { TaskContextMenuState } from "$lib/types/tasks/task-context-menu";

    import { TaskColor } from "$lib/types/tasks/task-color";
    import {
        normalizeViewingDate,
        getRangeStartForView,
        getRangeEndForView,
        addDays,
        addWeeks,
        addMonths,
        getTodayReferenceDate,
        isDateWithinRange,
    } from "$lib/utils/task-date-utils";
    import {
        getToolbarDateLabel,
        getViewingDateForViewChange,
    } from "$lib/utils/task-view-utils";

    import { inputCapabilities } from "$lib/stores/inputCapabilities";

    type TaskMoveDetail = {
        task: CalendarTask;
        start: Date;
        end: Date;
    };

    type DateRangeDetail = {
        start: Date;
        end: Date;
    };

    type DateDetail = {
        date: Date;
    };

    type DateRolloverDetail = {
        nextDate: Date;
    };

    let tasks: CalendarTask[] = $state([]);
    let viewingDate: Date = $state(normalizeViewingDate(new Date()));
    let currentView: CalendarView = $state("day");

    let isViewDropdownOpen: boolean = $state(false);
    let isDatePickerOpen: boolean = $state(false);
    let dateLabelElement: HTMLButtonElement | null = $state(null);

    let contextMenu: TaskContextMenuState | null = $state(null);

    let isTaskDialogOpen: boolean = $state(false);
    let taskDialogMode: "create" | "update" = $state("create");
    let selectedTask: CalendarTask | null = $state(null);
    let createDialogStartDate: Date | null = $state(null);

    let taskWeekViewElement: TaskWeekView | null = $state(null);

    const toolbarDateLabel: string = $derived(
        getToolbarDateLabel(currentView, viewingDate),
    );

    const showTodayButton: boolean = $derived(!doesCurrentViewContainToday());

    onMount((): void => {
        void loadTasksForViewingDate();
    });

    async function loadTasksForViewingDate(): Promise<void> {
        const rangeStart: Date = getRangeStartForView(currentView, viewingDate);

        const rangeEnd: Date = getRangeEndForView(currentView, viewingDate);

        tasks = await getCalendarTasksBetweenDates(rangeStart, rangeEnd);
    }

    async function loadTasksBetweenDates(
        start: Date,
        end: Date,
    ): Promise<void> {
        tasks = await getCalendarTasksBetweenDates(start, end);
    }

    function closeFloatingUi(): void {
        isViewDropdownOpen = false;
        isDatePickerOpen = false;
        contextMenu = null;
    }

    function closeContextMenu(): void {
        contextMenu = null;
    }

    function closeDatePicker(): void {
        isDatePickerOpen = false;
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

    function handleToggleDatePicker(event: MouseEvent): void {
        event.stopPropagation();
        isDatePickerOpen = !isDatePickerOpen;

        if (isDatePickerOpen) {
            isViewDropdownOpen = false;
            contextMenu = null;
        }
    }

    function handleToggleViewDropdown(event: MouseEvent): void {
        event.stopPropagation();
        isViewDropdownOpen = !isViewDropdownOpen;

        if (isViewDropdownOpen) {
            isDatePickerOpen = false;
            contextMenu = null;
        }
    }

    async function handleDatePickerSelect(date: Date): Promise<void> {
        const nextDate: Date = normalizeViewingDate(date);

        viewingDate = nextDate;
        closeDatePicker();

        if (currentView === "week") {
            taskWeekViewElement?.scrollToDate(nextDate);
        }

        await loadTasksForViewingDate();
    }

    function handleEmptyContextMenu(detail: EmptyContextMenuDetail): void {
        contextMenu = {
            mode: "empty",
            x: detail.x,
            y: detail.y,
            start: detail.start,
            end: detail.end,
        };
    }

    function handleTaskContextMenu(detail: TaskContextMenuDetail): void {
        contextMenu = {
            mode: "task",
            x: detail.x,
            y: detail.y,
            task: detail.task,
        };
    }

    function openCreateDialog(startDate?: Date): void {
        taskDialogMode = "create";
        selectedTask = null;
        createDialogStartDate = startDate ? new Date(startDate) : null;
        isTaskDialogOpen = true;
    }

    function handleMobileCreate(): void {
        openCreateDialog(viewingDate);
    }

    function openUpdateDialog(task: CalendarTask): void {
        taskDialogMode = "update";
        selectedTask = task;
        createDialogStartDate = null;
        isTaskDialogOpen = true;
    }

    function closeTaskDialog(): void {
        isTaskDialogOpen = false;
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

    async function handleTaskMove(detail: TaskMoveDetail): Promise<void> {
        const updatedTask: CalendarTask = await upsertCalendarTask({
            ...detail.task,
            start: detail.start,
            end: detail.end,
        });

        replaceTask(updatedTask);
    }

    function replaceTask(updatedTask: CalendarTask): void {
        tasks = tasks.map(
            (task: CalendarTask): CalendarTask =>
                task.id === updatedTask.id ? updatedTask : task,
        );
    }

    async function navigateViewingDate(direction: -1 | 1): Promise<void> {
        if (currentView === "day") {
            viewingDate = addDays(viewingDate, direction);
            await loadTasksForViewingDate();
            return;
        }

        if (currentView === "week") {
            viewingDate = addWeeks(viewingDate, direction);
            taskWeekViewElement?.scrollToDate(viewingDate);
            await loadTasksForViewingDate();
            return;
        }

        viewingDate = addMonths(viewingDate, direction);
        await loadTasksForViewingDate();
    }

    async function navigateToToday(): Promise<void> {
        const today: Date = getTodayReferenceDate();

        viewingDate = today;

        if (currentView === "week") {
            taskWeekViewElement?.scrollToDate(today);
        }

        await loadTasksForViewingDate();
    }

    async function setCurrentView(view: CalendarView): Promise<void> {
        if (view === currentView) {
            isViewDropdownOpen = false;
            return;
        }

        viewingDate = getViewingDateForViewChange(
            currentView,
            view,
            viewingDate,
        );

        currentView = view;
        isViewDropdownOpen = false;

        await loadTasksForViewingDate();
    }

    function doesCurrentViewContainToday(): boolean {
        const today: Date = getTodayReferenceDate();

        const rangeStart: Date = getRangeStartForView(currentView, viewingDate);

        const rangeEnd: Date = getRangeEndForView(currentView, viewingDate);

        return isDateWithinRange(today, rangeStart, rangeEnd);
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

    async function handleRequestDateRollover(
        detail: DateRolloverDetail,
    ): Promise<void> {
        viewingDate = normalizeViewingDate(detail.nextDate);
        await loadTasksForViewingDate();
    }

    function handleVisibleDateChange(detail: DateDetail): void {
        viewingDate = normalizeViewingDate(detail.date);
    }

    async function handleMonthDayClick(detail: DateDetail): Promise<void> {
        viewingDate = normalizeViewingDate(detail.date);
        currentView = "day";

        await loadTasksForViewingDate();
    }

    async function handleRequestDateRange(
        detail: DateRangeDetail,
    ): Promise<void> {
        await loadTasksBetweenDates(detail.start, detail.end);
    }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div class="tasks-page">
    <TaskPageToolbar
        bind:dateLabelElement
        {currentView}
        {viewingDate}
        dateLabel={toolbarDateLabel}
        {isDatePickerOpen}
        {isViewDropdownOpen}
        {showTodayButton}
        onToggleDatePicker={handleToggleDatePicker}
        onNavigatePrevious={(event: MouseEvent): void => {
            event.stopPropagation();
            void navigateViewingDate(-1);
        }}
        onNavigateNext={(event: MouseEvent): void => {
            event.stopPropagation();
            void navigateViewingDate(1);
        }}
        onNavigateToday={(event: MouseEvent): void => {
            event.stopPropagation();
            void navigateToToday();
        }}
        onToggleViewDropdown={handleToggleViewDropdown}
        onSelectView={(view: CalendarView): void => {
            void setCurrentView(view);
        }}
        onCloseViewDropdown={(): void => {
            isViewDropdownOpen = false;
        }}
    />

    {#if $inputCapabilities.isTouchLike}
        <button
            type="button"
            class="mobile-create-task-button"
            onclick={handleMobileCreate}
            aria-label="Create task"
            title="Create task"
        >
            +
        </button>
    {/if}

    <TaskViewRenderer
        bind:taskWeekViewElement
        {currentView}
        {tasks}
        {viewingDate}
        onEmptyContextMenu={handleEmptyContextMenu}
        onTaskContextMenu={handleTaskContextMenu}
        onTaskClick={openUpdateDialog}
        onTaskMove={handleTaskMove}
        onRequestDateRollover={handleRequestDateRollover}
        onVisibleDateChange={handleVisibleDateChange}
        onRequestDateRange={handleRequestDateRange}
        onDayClick={handleMonthDayClick}
    />
</div>

<TaskDatePickerPopup
    isOpen={isDatePickerOpen}
    anchorElement={dateLabelElement}
    value={viewingDate}
    onClose={closeDatePicker}
    onSelectDate={(date: Date): void => {
        void handleDatePickerSelect(date);
    }}
/>

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
    .tasks-page {
        position: relative;

        height: 100%;
        min-height: 0;

        display: grid;
        grid-template-rows: auto minmax(0, 1fr);

        overflow: visible;
        background: var(--color-bg-top);
    }
    
    .mobile-create-task-button {
        position: absolute;
        right: 1rem;
        bottom: 1rem;
        z-index: 20;

        display: flex;
        align-items: center;
        justify-content: center;

        width: 3.25rem;
        height: 3.25rem;

        padding: 0;
        border: none;
        border-radius: 50%;

        background: var(--color-accent);
        color: white;

        font-family: inherit;
        font-size: 1.75rem;
        font-weight: 500;
        line-height: 1;

        box-shadow: var(--shadow-float);
        cursor: pointer;
    }
</style>

<script lang="ts">
	import TaskDayView from "$lib/components/tasks/TaskDayView.svelte";
	import TaskWeekView from "$lib/components/tasks/TaskWeekView.svelte";
	import TaskMonthView from "$lib/components/tasks/TaskMonthView.svelte";

	import type { CalendarTask } from "$lib/types/tasks/calendar-task";
	import type { CalendarView } from "$lib/types/tasks/calendar-view";
	import type { EmptyContextMenuDetail } from "$lib/types/tasks/empty-context-menu-detail";
	import type { TaskContextMenuDetail } from "$lib/types/tasks/task-context-menu-detail";

	type TaskMoveDetail = {
		task: CalendarTask;
		start: Date;
		end: Date;
	};

	type Props = {
		currentView: CalendarView;
		tasks: CalendarTask[];
		viewingDate: Date;
		taskWeekViewElement: TaskWeekView | null;
		onEmptyContextMenu: (detail: EmptyContextMenuDetail) => void;
		onTaskContextMenu: (detail: TaskContextMenuDetail) => void;
		onTaskClick: (task: CalendarTask) => void;
		onTaskMove: (detail: TaskMoveDetail) => Promise<void>;
		onRequestDateRollover: (detail: { nextDate: Date }) => Promise<void>;
		onVisibleDateChange: (detail: { date: Date }) => void;
		onRequestDateRange: (detail: { start: Date; end: Date }) => Promise<void>;
		onDayClick: (detail: { date: Date }) => Promise<void>;
	};

	let {
		currentView,
		tasks,
		viewingDate,
		taskWeekViewElement = $bindable(),
		onEmptyContextMenu,
		onTaskContextMenu,
		onTaskClick,
		onTaskMove,
		onRequestDateRollover,
		onVisibleDateChange,
		onRequestDateRange,
		onDayClick,
	}: Props = $props();
</script>

<div class="tasks-view-shell">
	{#if currentView === "day"}
		<TaskDayView
			{tasks}
			date={viewingDate}
			{onEmptyContextMenu}
			{onTaskContextMenu}
			{onTaskClick}
			{onTaskMove}
			{onRequestDateRollover}
		/>
	{:else if currentView === "week"}
		<TaskWeekView
			bind:this={taskWeekViewElement}
			{tasks}
			date={viewingDate}
			{onEmptyContextMenu}
			{onTaskContextMenu}
			{onTaskClick}
			{onTaskMove}
			{onVisibleDateChange}
			{onRequestDateRange}
		/>
	{:else}
		<TaskMonthView
			{tasks}
			date={viewingDate}
			{onEmptyContextMenu}
			{onTaskContextMenu}
			{onTaskClick}
			{onTaskMove}
			{onDayClick}
			{onRequestDateRange}
		/>
	{/if}
</div>

<style>
	.tasks-view-shell {
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
</style>
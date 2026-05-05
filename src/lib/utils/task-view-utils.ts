import type { CalendarView } from "$lib/types/tasks/calendar-view";
import { getEndOfWeek, getRangeEndForView, getRangeStartForView, getStartOfWeek, getTodayReferenceDate, isDateWithinRange, normalizeViewingDate } from "./task-date-utils";

export function getViewRank(view: CalendarView): number {
	if (view === "day") {
		return 0;
	}

	if (view === "week") {
		return 1;
	}

	return 2;
}

export function getViewingDateForViewChange(
	previousView: CalendarView,
	nextView: CalendarView,
	currentValue: Date,
): Date {
	const previousRank: number = getViewRank(previousView);
	const nextRank: number = getViewRank(nextView);

	if (nextRank >= previousRank) {
		return normalizeViewingDate(currentValue);
	}

	const currentRangeStart: Date = getRangeStartForView(
		previousView,
		currentValue,
	);

	const currentRangeEnd: Date = getRangeEndForView(
		previousView,
		currentValue,
	);

	const today: Date = getTodayReferenceDate();

	if (isDateWithinRange(today, currentRangeStart, currentRangeEnd)) {
		return normalizeViewingDate(today);
	}

	return normalizeViewingDate(currentRangeStart);
}

export function formatDateDdMmYyyy(value: Date): string {
	const day: string = String(value.getDate()).padStart(2, "0");
	const month: string = String(value.getMonth() + 1).padStart(2, "0");
	const year: string = String(value.getFullYear());

	return `${day}/${month}/${year}`;
}

export function formatMonthLabel(value: Date): string {
	return value.toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});
}

export function getToolbarDateLabel(view: CalendarView, value: Date): string {
	if (view === "day") {
		return formatDateDdMmYyyy(value);
	}

	if (view === "week") {
		const start: Date = getStartOfWeek(value);
		const end: Date = getEndOfWeek(value);

		return `${formatDateDdMmYyyy(start)} - ${formatDateDdMmYyyy(end)}`;
	}

	return formatMonthLabel(value);
}
import type { CalendarView } from "$lib/types/tasks/calendar-view";

export function normalizeViewingDate(value: Date): Date {
	const result: Date = new Date(value);
	result.setHours(0, 1, 0, 0);
	return result;
}

export function getTodayReferenceDate(): Date {
	return normalizeViewingDate(new Date());
}

export function getStartOfDay(value: Date): Date {
	const result: Date = new Date(value);
	result.setHours(0, 1, 0, 0);
	return result;
}

export function getEndOfDay(value: Date): Date {
	const result: Date = new Date(value);
	result.setHours(23, 59, 59, 999);
	return result;
}

export function getStartOfWeek(value: Date): Date {
	const result: Date = normalizeViewingDate(value);
	const dayOfWeek: number = result.getDay();
	const distanceFromMonday: number = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

	result.setDate(result.getDate() - distanceFromMonday);
	result.setHours(0, 1, 0, 0);

	return result;
}

export function getEndOfWeek(value: Date): Date {
	const result: Date = getStartOfWeek(value);
	result.setDate(result.getDate() + 6);
	result.setHours(23, 59, 59, 999);
	return result;
}

export function getStartOfMonth(value: Date): Date {
	const result: Date = normalizeViewingDate(value);
	result.setDate(1);
	result.setHours(0, 1, 0, 0);
	return result;
}

export function getEndOfMonth(value: Date): Date {
	const result: Date = normalizeViewingDate(value);
	result.setMonth(result.getMonth() + 1, 0);
	result.setHours(23, 59, 59, 999);
	return result;
}

export function addDays(value: Date, amount: number): Date {
	const result: Date = normalizeViewingDate(value);
	result.setDate(result.getDate() + amount);
	return normalizeViewingDate(result);
}

export function addWeeks(value: Date, amount: number): Date {
	return addDays(value, amount * 7);
}

export function addMonths(value: Date, amount: number): Date {
	const result: Date = normalizeViewingDate(value);
	result.setMonth(result.getMonth() + amount);
	return normalizeViewingDate(result);
}

export function isDateWithinRange(value: Date, start: Date, end: Date): boolean {
	const time: number = value.getTime();

	return time >= start.getTime() && time <= end.getTime();
}

export function getRangeStartForView(view: CalendarView, value: Date): Date {
	if (view === "day") {
		return getStartOfDay(value);
	}

	if (view === "week") {
		return getStartOfWeek(value);
	}

	return getStartOfMonth(value);
}

export function getRangeEndForView(view: CalendarView, value: Date): Date {
	if (view === "day") {
		return getEndOfDay(value);
	}

	if (view === "week") {
		return getEndOfWeek(value);
	}

	return getEndOfMonth(value);
}
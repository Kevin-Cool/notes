import type { CalendarTask } from "$lib/types/tasks/calendar-task";
import { invoke } from "@tauri-apps/api/core";

type CalendarTaskPayload = {
    id?: string;
    title: string;
    description?: string | null;
    start: string;
    end: string;
    color: number;
};

function normalizeDate(value: string | Date): string {
    if (value instanceof Date) {
        return value.toISOString();
    }

    return new Date(value).toISOString();
}

function toPayload(task: CalendarTask): CalendarTaskPayload {
    return {
        id: task.id,
        title: task.title,
        description: task.description ?? null,
        start: normalizeDate(task.start),
        end: normalizeDate(task.end),
        color: task.color,
    };
}

export async function getCalendarTaskById(taskId: string): Promise<CalendarTask | null> {
    const task: CalendarTask | null = await invoke("get_calendar_task_by_id", {
        taskId,
    });

    return task;
}

export async function getAllCalendarTasks(): Promise<CalendarTask[]> {
    const tasks: CalendarTask[] = await invoke("get_all_calendar_tasks");

    return tasks;
}

export async function getCalendarTasksBetweenDates(
    rangeStart: string | Date,
    rangeEnd: string | Date,
): Promise<CalendarTask[]> {
    const tasks: CalendarTask[] = await invoke("get_calendar_tasks_between_dates", {
        rangeStart: normalizeDate(rangeStart),
        rangeEnd: normalizeDate(rangeEnd),
    });

    return tasks;
}

export async function upsertCalendarTask(task: CalendarTask): Promise<CalendarTask> {
    const savedTask: CalendarTask = await invoke("upsert_calendar_task", {
        task: toPayload(task),
    });

    return savedTask;
}

export async function createCalendarTask(
    task: Omit<CalendarTask, "id">,
): Promise<CalendarTask> {
    const savedTask: CalendarTask = await invoke("upsert_calendar_task", {
        task: {
            title: task.title,
            description: task.description ?? null,
            start: normalizeDate(task.start),
            end: normalizeDate(task.end),
            color: task.color,
        },
    });

    return savedTask;
}

export async function deleteCalendarTask(taskId: string): Promise<void> {
    await invoke("delete_calendar_task", {
        taskId,
    });
}
import type { CalendarTask } from "./calendar-task";

export type TaskContextMenuDetail = {
    x: number;
    y: number;
    task: CalendarTask;
};
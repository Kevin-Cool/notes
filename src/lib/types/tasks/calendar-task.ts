import type { TaskColor } from "./task-color";

export type CalendarTask = {
    id: string;
    title: string;
    description?: string | null;
    start: string | Date;
    end: string | Date;
    color: TaskColor;
};
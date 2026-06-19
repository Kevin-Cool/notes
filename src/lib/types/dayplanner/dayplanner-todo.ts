import type { TodoColor } from "./todo-color";

export type DayplannerTodo = {
    id: string;
    title?: string;
    color: TodoColor;
    completed: boolean;
    completionDate?: string | null;
};
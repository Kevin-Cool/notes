// src/lib/services/dayplanner-todo-service.ts
import { invoke } from "@tauri-apps/api/core";
import type { DayplannerTodo } from "$lib/types/dayplanner/dayplanner-todo";

type DayplannerTodoPayload = {
    id?: string;
    title: string;
    color: number;
    completed: boolean;
    completion_date?: string | null;
};

function toPayload(todo: DayplannerTodo): DayplannerTodoPayload {
    return {
        id: todo.id,
        title: todo.title ?? "",
        color: todo.color,
        completed: todo.completed,
        completion_date: todo.completionDate ?? null,
    };
}

export async function getAllDayplannerTodos(): Promise<DayplannerTodo[]> {
    const todos: DayplannerTodo[] = await invoke("get_all_dayplanner_todos");

    return todos;
}

export async function upsertDayplannerTodo(
    todo: DayplannerTodo,
): Promise<DayplannerTodo> {
    const savedTodo: DayplannerTodo = await invoke("upsert_dayplanner_todo", {
        todo: toPayload(todo),
    });

    return savedTodo;
}

export async function createDayplannerTodo(
    todo: Omit<DayplannerTodo, "id">,
): Promise<DayplannerTodo> {
    const savedTodo: DayplannerTodo = await invoke("upsert_dayplanner_todo", {
        todo: {
            title: todo.title ?? "",
            color: todo.color,
            completed: todo.completed,
            completion_date: todo.completionDate ?? null,
        },
    });

    return savedTodo;
}

export async function deleteDayplannerTodo(todoId: string): Promise<void> {
    await invoke("delete_dayplanner_todo", {
        todoId,
    });
}
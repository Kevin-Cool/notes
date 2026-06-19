import type { DayplannerTodo } from "./dayplanner-todo";

export type TodoContextMenuState =
    | {
          mode: "empty";
          x: number;
          y: number;
      }
    | {
          mode: "todo";
          x: number;
          y: number;
          todo: DayplannerTodo;
      };
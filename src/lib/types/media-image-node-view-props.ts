import type { EditorView } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export type MediaImageNodeViewProps = {
    node: ProseMirrorNode;
    view: EditorView;
    getPos: (() => number | undefined) | boolean;
};
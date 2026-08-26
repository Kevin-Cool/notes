import { Node, mergeAttributes, type CommandProps } from "@tiptap/core";
import type { NodeViewRendererProps } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { Fragment as ProseMirrorFragment, Schema } from "@tiptap/pm/model";
import { Fragment } from "@tiptap/pm/model";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        fastCopy: {
            setFastCopy: () => ReturnType;
            toggleFastCopy: () => ReturnType;
            unsetFastCopy: () => ReturnType;
        };
    }
}
type FastCopyOptions = {
    copyIconSrc: string | null;
};

export const FastCopy = Node.create<FastCopyOptions>({
    name: "fastCopy",

    addOptions(): FastCopyOptions {
        return {
            copyIconSrc: null,
        };
    },

    group: "inline",
    inline: true,
    content: "text*",
    selectable: true,
    atom: false,


    parseHTML(): Array<{
        tag: string;
        getContent?: (
            node: globalThis.Node,
            schema: Schema,
        ) => ProseMirrorFragment;
    }> {
        return [
            {
                tag: 'span[data-fast-copy="true"]',

                getContent: (
                    node: globalThis.Node,
                    schema: Schema,
                ): ProseMirrorFragment => {
                    if (!(node instanceof HTMLElement)) {
                        return Fragment.empty;
                    }

                    const textElement: Element | null =
                        node.querySelector(".fast-copy-text");

                    const textContent: string =
                        textElement?.textContent ?? node.textContent ?? "";

                    if (textContent.length === 0) {
                        return Fragment.empty;
                    }

                    return Fragment.from(schema.text(textContent));
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            "span",
            mergeAttributes(HTMLAttributes, {
                "data-fast-copy": "true",
                class: "fast-copy",
            }),
            0,
        ];
    },

    addCommands(): {
        setFastCopy: () => ({ state, tr, dispatch }: CommandProps) => boolean;
        toggleFastCopy: () => ({ editor }: CommandProps) => boolean;
        unsetFastCopy: () => ({ state, tr, dispatch }: CommandProps) => boolean;
    } {
        return {
            setFastCopy:
                () =>
                    ({ state, tr, dispatch }: CommandProps): boolean => {
                        const from: number = state.selection.from;
                        const to: number = state.selection.to;

                        if (state.selection.empty) {
                            return false;
                        }

                        const fastCopyNodeType = state.schema.nodes.fastCopy;

                        if (!fastCopyNodeType) {
                            return false;
                        }

                        const selectedSlice = state.doc.slice(from, to);
                        const selectedContent = selectedSlice.content;

                        if (selectedContent.size === 0) {
                            return false;
                        }

                        const fastCopyNode = fastCopyNodeType.create(null, selectedContent);

                        tr.replaceRangeWith(from, to, fastCopyNode);

                        const nextFrom: number = from + 1;
                        const nextTo: number = nextFrom + fastCopyNode.content.size;

                        tr.setSelection(TextSelection.create(tr.doc, nextFrom, nextTo));

                        if (dispatch) {
                            dispatch(tr);
                        }

                        return true;
                    },

            toggleFastCopy:
                () =>
                    ({ editor }: CommandProps): boolean => {
                        if (editor.isActive("fastCopy")) {
                            return editor.commands.unsetFastCopy();
                        }

                        return editor.commands.setFastCopy();
                    },

            unsetFastCopy:
                () =>
                    ({ state, tr, dispatch }: CommandProps): boolean => {
                        const selectionFrom: number = state.selection.from;
                        const selectionTo: number = state.selection.to;

                        let targetPosition: number | null = null;
                        let targetNodeSize: number | null = null;
                        let targetContent = null as typeof state.doc.content | null;

                        state.doc.nodesBetween(
                            selectionFrom,
                            selectionTo,
                            (node, position): void => {
                                if (node.type.name === "fastCopy" && targetPosition === null) {
                                    targetPosition = position;
                                    targetNodeSize = node.nodeSize;
                                    targetContent = node.content;
                                }
                            },
                        );

                        if (
                            targetPosition === null ||
                            targetNodeSize === null ||
                            targetContent === null
                        ) {
                            return false;
                        }

                        tr.replaceWith(
                            targetPosition,
                            targetPosition + targetNodeSize,
                            targetContent,
                        );

                        if (dispatch) {
                            dispatch(tr);
                        }

                        return true;
                    },
        };
    },

    addNodeView() {
        return ({ node, HTMLAttributes }: NodeViewRendererProps) => {
            const wrapperElement: HTMLSpanElement = document.createElement("span");
            wrapperElement.className = "fast-copy";
            wrapperElement.setAttribute("data-fast-copy", "true");

            for (const [key, value] of Object.entries(HTMLAttributes)) {
                if (typeof value === "string") {
                    wrapperElement.setAttribute(key, value);
                }
            }

            const iconButtonElement: HTMLButtonElement =
                document.createElement("button");
            iconButtonElement.type = "button";
            iconButtonElement.className = "fast-copy-icon";
            iconButtonElement.setAttribute("contenteditable", "false");
            iconButtonElement.setAttribute("aria-label", "Copy text");
            iconButtonElement.setAttribute("title", "Copy text");
            if (this.options.copyIconSrc) {
                const iconImageElement: HTMLImageElement = document.createElement("img");
                iconImageElement.src = this.options.copyIconSrc;
                iconImageElement.alt = "";
                iconImageElement.setAttribute("aria-hidden", "true");

                iconButtonElement.appendChild(iconImageElement);
            } else {
                iconButtonElement.textContent = "⧉";
            }

            const contentElement: HTMLSpanElement = document.createElement("span");
            contentElement.className = "fast-copy-text";

            iconButtonElement.addEventListener(
                "pointerdown",
                (event: PointerEvent): void => {
                    event.preventDefault();
                    event.stopPropagation();
                },
            );

            iconButtonElement.addEventListener(
                "click",
                (event: MouseEvent): void => {
                    event.preventDefault();
                    event.stopPropagation();

                    const textToCopy: string = node.textContent;

                    void writeText(textToCopy).catch((error: unknown): void => {
                        console.error("Failed to copy fast-copy text:", error);
                    });
                },
            );

            wrapperElement.append(iconButtonElement, contentElement);

            return {
                dom: wrapperElement,
                contentDOM: contentElement,
            };
        };
    },
});
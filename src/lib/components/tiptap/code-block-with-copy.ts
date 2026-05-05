import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { mergeAttributes, type NodeViewRendererProps } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { NodeView as ProseMirrorNodeView } from "@tiptap/pm/view";
import { createLowlight, common } from "lowlight";

function createCodeBlockNodeView(
    props: NodeViewRendererProps,
): ProseMirrorNodeView {
    const wrapperElement: HTMLDivElement = document.createElement("div");
    wrapperElement.className = "code-block-wrapper";

    const preElement: HTMLPreElement = document.createElement("pre");
    const codeElement: HTMLElement = document.createElement("code");

    const copyButtonElement: HTMLButtonElement =
        document.createElement("button");
    copyButtonElement.type = "button";
    copyButtonElement.className = "code-block-copy-button";
    copyButtonElement.textContent = "Copy";
    copyButtonElement.setAttribute("contenteditable", "false");

    for (const [key, value] of Object.entries(props.HTMLAttributes)) {
        if (typeof value === "string") {
            codeElement.setAttribute(key, value);
        }
    }

    preElement.appendChild(codeElement);
    wrapperElement.appendChild(copyButtonElement);
    wrapperElement.appendChild(preElement);

    const handleCopyClick = (): void => {
        void (async (): Promise<void> => {
            const codeText: string = props.node.textContent;

            try {
                await navigator.clipboard.writeText(codeText);
                copyButtonElement.textContent = "Copied";

                window.setTimeout((): void => {
                    copyButtonElement.textContent = "Copy";
                }, 1200);
            } catch (error: unknown) {
                console.error("Failed to copy code block:", error);
                copyButtonElement.textContent = "Failed";

                window.setTimeout((): void => {
                    copyButtonElement.textContent = "Copy";
                }, 1200);
            }
        })();
    };

    copyButtonElement.addEventListener("click", handleCopyClick);

    return {
        dom: wrapperElement,
        contentDOM: codeElement,

        update(updatedNode: ProseMirrorNode): boolean {
            return updatedNode.type.name === props.node.type.name;
        },

        stopEvent(event: Event): boolean {
            const target: EventTarget | null = event.target;

            return (
                target instanceof HTMLElement &&
                target.closest(".code-block-copy-button") !== null
            );
        },

        destroy(): void {
            copyButtonElement.removeEventListener("click", handleCopyClick);
        },
    };
}

const lowlight = createLowlight(common);

export const CodeBlockWithCopy = CodeBlockLowlight.extend({
    addNodeView() {
        return (props: NodeViewRendererProps): ProseMirrorNodeView => {
            return createCodeBlockNodeView(props);
        };
    },

    renderHTML({ HTMLAttributes }) {
        return ["pre", mergeAttributes(HTMLAttributes), ["code", 0]];
    },
}).configure({
    lowlight,
});
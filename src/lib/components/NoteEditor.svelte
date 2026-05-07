<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { Editor } from "@tiptap/core";
    import StarterKit from "@tiptap/starter-kit";
    import TaskList from "@tiptap/extension-task-list";
    import TaskItem from "@tiptap/extension-task-item";
    import TextAlign from "@tiptap/extension-text-align";
    import { openUrl } from "@tauri-apps/plugin-opener";
    import { goto } from "$app/navigation";
    import { FastCopy } from "$lib/components/tiptap/fast-copy";
    import {
        importMediaBytes,
        getMediaFilePath,
    } from "$lib/services/media-service";
    import { convertFileSrc } from "@tauri-apps/api/core";

    import bullet_list from "$lib/assets/icons/bullet_list.svg";
    import ordered_list from "$lib/assets/icons/ordered_list.svg";
    import task_list from "$lib/assets/icons/task_list.svg";
    import backquote from "$lib/assets/icons/backquote.svg";
    import code_block from "$lib/assets/icons/code_block.svg";
    import clear_icon from "$lib/assets/icons/clear_icon.svg";
    import color_select_icon from "$lib/assets/icons/color_select_icon.svg";
    import align_left from "$lib/assets/icons/align_left.svg";
    import align_center from "$lib/assets/icons/align_center.svg";
    import align_right from "$lib/assets/icons/align_right.svg";
    import link_icon from "$lib/assets/icons/link_icon.svg";
    import copy_icon from "$lib/assets/icons/copy_icon.svg";

    import { MediaImage } from "./tiptap/media-image";
    import { CodeBlockWithCopy } from "./tiptap/code-block-with-copy";
    import LinkDialog from "./tiptap/LinkDialog.svelte";

    import Color from "@tiptap/extension-color";
    import { TextStyle } from "@tiptap/extension-text-style";
    import Highlight from "@tiptap/extension-highlight";

    let {
        noteId,
        noteName = "",
        initialContent = null,
        onContentChange,
        onRenameNote,
    }: {
        noteId: string;
        noteName?: string;
        initialContent?: string | null;
        onContentChange?: (content: string) => void;
        onRenameNote?: (name: string) => void | Promise<void>;
    } = $props();

    let editorElement: HTMLDivElement | null = null;
    let editor: Editor | null = null;

    let openMenu: "heading" | "list" | "textColor" | "highlightColor" | null =
        $state(null);

    let isReady: boolean = $state(false);
    let isModifierPressed: boolean = $state(false);
    let isHoveringLink: boolean = $state(false);

    let hoveredLinkUrl: string | null = $state(null);
    let hoveredLinkLeft: number = $state(0);
    let hoveredLinkTop: number = $state(0);

    let isHoveringPreview: boolean = $state(false);

    let hidePreviewTimeout: ReturnType<typeof setTimeout> | null = null;

    let isLinkDialogOpen: boolean = $state(false);
    let linkDialogType: LinkType = $state("external");
    let linkDialogValue: string = $state("");

    let isRenameDialogOpen: boolean = $state(false);
    let renameInput: string = $state("");
    let renameError: string = $state("");
    let isRenaming: boolean = $state(false);

    function openRenameDialog(): void {
        renameInput = noteName.trim().length > 0 ? noteName : "Untitled note";
        renameError = "";
        isRenameDialogOpen = true;
    }

    function closeRenameDialog(): void {
        if (isRenaming) return;

        isRenameDialogOpen = false;
        renameInput = "";
        renameError = "";
    }

    async function submitRename(): Promise<void> {
        const nextName: string = renameInput.trim();

        renameError = "";

        if (nextName.length === 0) {
            renameError = "Title is required.";
            return;
        }

        isRenaming = true;

        try {
            await onRenameNote?.(nextName);

            isRenaming = false;
            closeRenameDialog();
        } catch {
            renameError = "Failed to rename note.";
        } finally {
            isRenaming = false;
        }
    }

    function handleRenameDialogBackdropClick(event: MouseEvent): void {
        if (event.target !== event.currentTarget) {
            return;
        }

        closeRenameDialog();
    }

    $effect((): void => {
        if (!editor) return;
        if (initialContent === null || initialContent === undefined) return;

        const nextContent: string =
            initialContent.trim().length > 0
                ? initialContent
                : getDefaultContent();

        if (editor.getHTML() === nextContent) {
            return;
        }

        editor.commands.setContent(nextContent, { emitUpdate: false });
        refreshState();
    });

    function getDefaultContent(): string {
        return "<h2>Untitled note</h2><p>Start writing…</p>";
    }

    function hasRealContent(content: string | null | undefined): boolean {
        return typeof content === "string";
    }

    function getInitialEditorContent(): string {
        if (
            typeof initialContent === "string" &&
            initialContent.trim().length > 0
        ) {
            return initialContent;
        }

        return "<h2>Untitled note</h2><p>Start writing…</p>";
    }

    function clearHidePreviewTimeout(): void {
        if (hidePreviewTimeout) {
            clearTimeout(hidePreviewTimeout);
            hidePreviewTimeout = null;
        }
    }

    function hideLinkPreview(): void {
        isHoveringLink = false;
        isHoveringPreview = false;
        hoveredLinkUrl = null;
    }

    function scheduleHideLinkPreview(): void {
        clearHidePreviewTimeout();

        hidePreviewTimeout = setTimeout((): void => {
            if (!isHoveringLink && !isHoveringPreview) {
                hideLinkPreview();
            }
        }, 120);
    }
    function refreshState(): void {
        isReady = !isReady;
        isReady = !isReady;
    }

    function run(command: () => boolean): void {
        if (!editor) return;
        command();
        refreshState();
    }

    function isActive(name: string, attrs?: Record<string, unknown>): boolean {
        return editor ? editor.isActive(name, attrs) : false;
    }

    function isTextAlignActive(
        alignment: "left" | "center" | "right",
    ): boolean {
        return editor ? editor.isActive({ textAlign: alignment }) : false;
    }

    function toggleMenu(
        menu: "heading" | "list" | "textColor" | "highlightColor",
    ): void {
        openMenu = openMenu === menu ? null : menu;
    }

    function closeMenu(): void {
        openMenu = null;
    }

    function setHeading(level: 1 | 2 | 3 | 4): void {
        run(() => editor!.chain().focus().setHeading({ level }).run());
        closeMenu();
    }

    function toggleBulletList(): void {
        run(() => editor!.chain().focus().toggleBulletList().run());
        closeMenu();
    }

    function toggleOrderedList(): void {
        run(() => editor!.chain().focus().toggleOrderedList().run());
        closeMenu();
    }

    function toggleTaskList(): void {
        run(() => editor!.chain().focus().toggleTaskList().run());
        closeMenu();
    }

    function handleEditorAreaClick(): void {
        closeMenu();
    }

    function normalizeUrl(url: string): string {
        if (!/^https?:\/\//i.test(url)) {
            return `https://${url}`;
        }
        return url;
    }

    function updateModifierState(event: KeyboardEvent): void {
        isModifierPressed = event.ctrlKey || event.metaKey;
    }

    function clearModifierState(): void {
        isModifierPressed = false;
    }

    function updateHoveredLink(event: MouseEvent): void {
        const target: EventTarget | null = event.target;

        if (!(target instanceof HTMLElement)) {
            isHoveringLink = false;
            scheduleHideLinkPreview();
            return;
        }

        const linkElement: HTMLAnchorElement | null = target.closest("a");

        if (!linkElement) {
            isHoveringLink = false;
            scheduleHideLinkPreview();
            return;
        }

        const href: string | null = linkElement.getAttribute("href");

        if (!href) {
            isHoveringLink = false;
            scheduleHideLinkPreview();
            return;
        }

        clearHidePreviewTimeout();

        const rect: DOMRect = linkElement.getBoundingClientRect();

        isHoveringLink = true;
        hoveredLinkUrl = href;

        hoveredLinkLeft = rect.left + rect.width / 2;
        hoveredLinkTop = rect.bottom + 45;
    }

    function getLinkTypeFromHref(href: string): LinkType {
        return href.startsWith("note://") ? "note" : "external";
    }

    function getLinkDialogValueFromHref(href: string): string {
        if (href.startsWith("note://")) {
            return href.replace("note://", "").trim();
        }

        return href;
    }

    function openLinkDialog(): void {
        if (!editor) return;

        const currentHref: string = editor.getAttributes("link").href ?? "";

        isLinkDialogOpen = true;
        linkDialogType = getLinkTypeFromHref(currentHref);
        linkDialogValue = getLinkDialogValueFromHref(currentHref);
    }

    function closeLinkDialog(): void {
        isLinkDialogOpen = false;
        linkDialogValue = "";
        linkDialogType = "external";
    }

    function submitLinkDialog(detail: {
        type: LinkType;
        value: string;
        navigateToNoteId?: string;
    }): void {
        if (!editor) return;

        const trimmedValue: string = detail.value.trim();

        if (!trimmedValue) {
            editor.chain().focus().unsetLink().run();
            refreshState();
            closeLinkDialog();
            return;
        }

        if (detail.type === "external") {
            const href: string = normalizeUrl(trimmedValue);
            editor.chain().focus().setLink({ href }).run();
        }

        if (detail.type === "note") {
            const href: string = `note://${trimmedValue}`;
            editor.chain().focus().setLink({ href }).run();
        }

        refreshState();
        closeLinkDialog();

        if (detail.navigateToNoteId) {
            void goto(`/note/${detail.navigateToNoteId}`);
        }
    }

    function removeLinkFromDialog(): void {
        if (!editor) return;

        editor.chain().focus().unsetLink().run();
        refreshState();
        closeLinkDialog();
    }
    function isExternalUrl(text: string): boolean {
        const trimmedText: string = text.trim();

        try {
            const url: URL = new URL(trimmedText);

            return url.protocol === "http:" || url.protocol === "https:";
        } catch {
            return false;
        }
    }

    function looksLikeJson(text: string): boolean {
        const trimmedText: string = text.trim();

        if (
            !(trimmedText.startsWith("{") && trimmedText.endsWith("}")) &&
            !(trimmedText.startsWith("[") && trimmedText.endsWith("]"))
        ) {
            return false;
        }

        try {
            JSON.parse(trimmedText);
            return true;
        } catch {
            return false;
        }
    }

    function formatJson(text: string): string {
        const parsedValue: unknown = JSON.parse(text);
        return JSON.stringify(parsedValue, null, 2);
    }

    function looksLikeCode(text: string): boolean {
        const trimmedText: string = text.trim();

        if (trimmedText.length === 0) {
            return false;
        }

        if (looksLikeJson(trimmedText)) {
            return true;
        }

        const hasMultipleLines: boolean = trimmedText.includes("\n");
        const hasIndentation: boolean = /^( {2,}|\t+)/m.test(trimmedText);

        const hasCodeKeywords: boolean =
            /\b(const|let|var|function|class|interface|type|import|export|return|if|else|for|while|switch|case|try|catch|async|await|public|private|protected|enum|implements|extends|new)\b/.test(
                trimmedText,
            );

        const hasAssignmentOrArrow: boolean = /=>|=\s*[^=]/.test(trimmedText);

        const hasCodeDelimiters: boolean = /[{}[\];]/.test(trimmedText);

        const hasFunctionCall: boolean =
            /\b[a-zA-Z_$][\w$]*\s*\([^()\n]*\)/.test(trimmedText);

        const looksLikeHtml: boolean = /<\/?[a-z][\s\S]*>/i.test(trimmedText);

        const looksLikeCss: boolean =
            /^[.#]?[a-zA-Z0-9\-_]+\s*\{[\s\S]*\}$/m.test(trimmedText);

        if (looksLikeHtml || looksLikeCss) {
            return true;
        }

        if (hasMultipleLines && hasIndentation) {
            return true;
        }

        const strongSignals: number = [
            hasCodeKeywords,
            hasAssignmentOrArrow,
            hasCodeDelimiters,
            hasFunctionCall,
        ].filter(Boolean).length;

        if (hasMultipleLines && strongSignals >= 1) {
            return true;
        }

        if (!hasMultipleLines && strongSignals >= 2) {
            return true;
        }

        return false;
    }

    function insertLinkFromPaste(
        view: import("prosemirror-view").EditorView,
        rawText: string,
    ): boolean {
        const trimmedText: string = rawText.trim();
        const href: string = normalizeUrl(trimmedText);

        const { state } = view;
        const { from, to, empty } = state.selection;
        const linkMark = state.schema.marks.link;

        if (!linkMark) {
            return false;
        }

        const transaction = state.tr;

        if (empty) {
            const linkedTextNode = state.schema.text(trimmedText, [
                linkMark.create({ href }),
            ]);

            transaction.replaceSelectionWith(linkedTextNode, false);
        } else {
            transaction.addMark(from, to, linkMark.create({ href }));
        }

        view.dispatch(transaction);
        return true;
    }

    function insertCodeBlockFromPaste(
        view: import("prosemirror-view").EditorView,
        rawText: string,
    ): boolean {
        const { state } = view;
        const { from, to } = state.selection;
        const codeBlockNodeType = state.schema.nodes.codeBlock;

        if (!codeBlockNodeType) {
            return false;
        }

        let codeText: string = rawText;

        if (looksLikeJson(rawText)) {
            codeText = formatJson(rawText);
        } else {
            codeText = normalizeIndentation(rawText);
        }

        const codeBlockNode = codeBlockNodeType.create(
            null,
            state.schema.text(codeText),
        );

        const transaction = state.tr.replaceWith(from, to, codeBlockNode);

        view.dispatch(transaction);
        return true;
    }
    function normalizeIndentation(text: string): string {
        const normalizedText: string = text.replace(/\r\n/g, "\n");
        const lines: string[] = normalizedText.split("\n");

        let minimumIndent: number | null = null;

        for (const line of lines) {
            if (line.trim().length === 0) {
                continue;
            }

            const indentMatch: RegExpMatchArray | null = line.match(/^[\t ]*/);

            if (!indentMatch) {
                continue;
            }

            const indentText: string = indentMatch[0];
            const indentWidth: number = getIndentWidth(indentText);

            if (minimumIndent === null || indentWidth < minimumIndent) {
                minimumIndent = indentWidth;
            }
        }

        if (minimumIndent === null || minimumIndent === 0) {
            return lines.join("\n").trim();
        }

        const dedentedLines: string[] = lines.map((line: string): string => {
            if (line.trim().length === 0) {
                return "";
            }

            return removeIndentWidth(line, minimumIndent);
        });

        return dedentedLines.join("\n").trim();
    }

    function getIndentWidth(indentText: string): number {
        let width: number = 0;

        for (const character of indentText) {
            if (character === "\t") {
                width += 4;
                continue;
            }

            width += 1;
        }

        return width;
    }

    function removeIndentWidth(line: string, widthToRemove: number): string {
        let currentWidth: number = 0;
        let cutIndex: number = 0;

        while (cutIndex < line.length && currentWidth < widthToRemove) {
            const character: string = line[cutIndex];

            if (character === "\t") {
                currentWidth += 4;
                cutIndex += 1;
                continue;
            }

            if (character === " ") {
                currentWidth += 1;
                cutIndex += 1;
                continue;
            }

            break;
        }

        return line.slice(cutIndex);
    }

    function buildMediaUrl(mediaId: string): string {
        return `media://${mediaId}`;
    }

    function extractMediaId(src: string): string | null {
        if (!src.startsWith("media://")) {
            return null;
        }

        return src.replace("media://", "").trim() || null;
    }

    async function resolveMediaUrl(src: string): Promise<string> {
        const mediaId: string | null = extractMediaId(src);

        if (!mediaId) {
            return src;
        }

        const filePath: string | null = await getMediaFilePath(mediaId);

        if (!filePath) {
            return src;
        }

        return convertFileSrc(filePath);
    }

    function getClipboardImageFile(event: ClipboardEvent): File | null {
        const clipboardData: DataTransfer | null = event.clipboardData;

        if (!clipboardData) {
            return null;
        }

        for (const item of Array.from(clipboardData.items)) {
            if (item.kind === "file" && item.type.startsWith("image/")) {
                const file: File | null = item.getAsFile();

                if (file) {
                    return file;
                }
            }
        }

        return null;
    }

    async function insertImageFromPaste(
        view: import("prosemirror-view").EditorView,
        file: File,
    ): Promise<boolean> {
        const media = await importMediaBytes(file);

        const canonicalSrc: string = buildMediaUrl(media.id);
        const displaySrc: string = await resolveMediaUrl(canonicalSrc);

        const { state } = view;
        const imageNodeType = state.schema.nodes.image;

        if (!imageNodeType) {
            return false;
        }

        const dimensions = await getImageDimensions(file);

        const imageNode = imageNodeType.create({
            src: displaySrc,
            alt: media.original_name,
            mediaId: media.id,
            mediaSrc: canonicalSrc,
            width: String(dimensions.width),
            height: String(dimensions.height),
        });

        const transaction = state.tr.replaceSelectionWith(imageNode, false);
        view.dispatch(transaction);

        return true;
    }

    async function getImageDimensions(file: File): Promise<{
        width: number;
        height: number;
    }> {
        const objectUrl: string = URL.createObjectURL(file);

        try {
            const dimensions: { width: number; height: number } =
                await new Promise(
                    (
                        resolve: (value: {
                            width: number;
                            height: number;
                        }) => void,
                        reject: (reason?: unknown) => void,
                    ): void => {
                        const image: HTMLImageElement = new window.Image();

                        image.onload = (): void => {
                            resolve({
                                width: image.naturalWidth,
                                height: image.naturalHeight,
                            });
                        };

                        image.onerror = reject;
                        image.src = objectUrl;
                    },
                );

            return dimensions;
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }

    onMount((): (() => void) => {
        const resizeObserver: ResizeObserver = new ResizeObserver((): void => {
            measureToolbarLayout();
        });

        if (toolbarElement) {
            resizeObserver.observe(toolbarElement);
        }

        if (toolbarInnerElement) {
            resizeObserver.observe(toolbarInnerElement);
        }

        queueMicrotask((): void => {
            measureToolbarLayout();
        });

        const handleKeyDown = (event: KeyboardEvent): void => {
            updateModifierState(event);
        };

        const handleKeyUp = (event: KeyboardEvent): void => {
            updateModifierState(event);
        };

        const handleWindowBlur = (): void => {
            clearModifierState();
            isHoveringLink = false;
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        window.addEventListener("blur", handleWindowBlur);

        editor = new Editor({
            element: editorElement ?? undefined,
            extensions: [
                StarterKit.configure({
                    codeBlock: false,
                    link: {
                        openOnClick: false,
                        autolink: true,
                        linkOnPaste: true,
                        protocols: [
                            {
                                scheme: "note",
                                optionalSlashes: true,
                            },
                        ],
                    },
                }),
                CodeBlockWithCopy,
                TaskList,
                TaskItem.configure({
                    nested: true,
                }),
                TextAlign.configure({
                    types: ["heading", "paragraph"],
                }),
                TextStyle,
                Color,
                Highlight.configure({
                    multicolor: true,
                }),
                MediaImage,
                FastCopy.configure({
                    copyIconSrc: copy_icon,
                }),
            ],
            content: getInitialEditorContent(),
            autofocus: "end",
            editorProps: {
                attributes: {
                    class: "tiptap-editor",
                },
                handlePaste: (view, event): boolean => {
                    const clipboardEvent: ClipboardEvent = event;
                    const imageFile: File | null =
                        getClipboardImageFile(clipboardEvent);

                    if (imageFile) {
                        event.preventDefault();

                        void insertImageFromPaste(view, imageFile).catch(
                            (error: unknown) => {
                                console.error("failed to paste image:", error);
                            },
                        );

                        return true;
                    }

                    const clipboardData: DataTransfer | null =
                        event.clipboardData;
                    const pastedText: string =
                        clipboardData?.getData("text/plain") ?? "";
                    const trimmedText: string = pastedText.trim();

                    if (trimmedText.length === 0) {
                        return false;
                    }

                    // 1) Plain external URL -> make/link it
                    if (isExternalUrl(trimmedText)) {
                        event.preventDefault();
                        return insertLinkFromPaste(view, trimmedText);
                    }

                    // 2) If already inside a code block, paste normally
                    if (editor?.isActive("codeBlock")) {
                        return false;
                    }

                    // 3) JSON or obvious code -> code block
                    if (looksLikeCode(pastedText)) {
                        event.preventDefault();
                        return insertCodeBlockFromPaste(view, pastedText);
                    }

                    return false;
                },
                handleDOMEvents: {
                    click: (_view, event): boolean => {
                        const mouseEvent: MouseEvent = event;
                        const target: EventTarget | null = mouseEvent.target;

                        if (!(target instanceof HTMLElement)) {
                            return false;
                        }

                        const linkElement: HTMLAnchorElement | null =
                            target.closest("a");

                        if (!linkElement) {
                            return false;
                        }

                        const href: string | null =
                            linkElement.getAttribute("href");

                        mouseEvent.preventDefault();
                        mouseEvent.stopPropagation();

                        if (!href) {
                            return true;
                        }

                        const shouldOpen: boolean =
                            mouseEvent.ctrlKey || mouseEvent.metaKey;

                        if (shouldOpen) {
                            if (href.startsWith("note://")) {
                                const noteID: string = href
                                    .replace("note://", "")
                                    .trim();

                                if (noteID.length > 0) {
                                    void goto(`/note/${noteID}`);
                                }
                            } else {
                                void openUrl(href);
                            }
                        }

                        return true;
                    },
                    mousemove: (_view, event): boolean => {
                        updateHoveredLink(event);
                        return false;
                    },
                    mouseleave: (): boolean => {
                        isHoveringLink = false;
                        scheduleHideLinkPreview();
                        return false;
                    },
                },
            },
            onCreate: (): void => {
                isReady = true;
            },
            onUpdate: (): void => {
                refreshState();
                if (editor && onContentChange) {
                    const html: string = editor.getHTML();
                    onContentChange(html);
                }
            },
            onSelectionUpdate: (): void => {
                refreshState();
            },
        });

        return (): void => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("blur", handleWindowBlur);
            resizeObserver.disconnect();
            editor?.destroy();
        };
    });

    onDestroy((): void => {
        editor?.destroy();
    });

    type ColorOption = {
        label: string;
        value: string;
    };

    const textColorOptions: ColorOption[] = [
        { label: "Default", value: "" },
        { label: "Red", value: "#d63b53" },
        { label: "Orange", value: "#e67e22" },
        { label: "Yellow", value: "#d4a017" },
        { label: "Green", value: "#2f9e5f" },
        { label: "Blue", value: "#3f63d9" },
        { label: "Purple", value: "#7a4fd6" },
    ];

    const highlightColorOptions: ColorOption[] = [
        { label: "Clear", value: "" },
        { label: "Rose", value: "rgba(224, 122, 150, 0.28)" },
        { label: "Yellow", value: "rgba(212, 160, 23, 0.28)" },
        { label: "Green", value: "rgba(47, 158, 95, 0.24)" },
        { label: "Blue", value: "rgba(63, 99, 217, 0.22)" },
        { label: "Purple", value: "rgba(122, 79, 214, 0.22)" },
    ];

    function setTextColor(color: string): void {
        if (color.length === 0) {
            run(() => editor!.chain().focus().unsetColor().run());
            closeMenu();
            return;
        }

        run(() => editor!.chain().focus().setColor(color).run());
        closeMenu();
    }

    function setHighlightColor(color: string): void {
        if (color.length === 0) {
            run(() => editor!.chain().focus().unsetHighlight().run());
            closeMenu();
            return;
        }

        run(() => editor!.chain().focus().setHighlight({ color }).run());
        closeMenu();
    }

    type ToolbarButton = {
        label?: string;
        icon?: string;
        description: string;
        action: () => void;
        active?: () => boolean;
    };

    type LinkType = "external" | "note";

    const styleButtons: ToolbarButton[] = [
        {
            label: "B",
            description: "Bold",
            action: (): void =>
                run(() => editor!.chain().focus().toggleBold().run()),
            active: (): boolean => isActive("bold"),
        },
        {
            label: "I",
            description: "Italic",
            action: (): void =>
                run(() => editor!.chain().focus().toggleItalic().run()),
            active: (): boolean => isActive("italic"),
        },
        {
            label: "S",
            description: "Slash",
            action: (): void =>
                run(() => editor!.chain().focus().toggleStrike().run()),
            active: (): boolean => isActive("strike"),
        },
        {
            label: "U",
            description: "Underline",
            action: (): void =>
                run(() => editor!.chain().focus().toggleUnderline().run()),
            active: (): boolean => isActive("underline"),
        },
    ];

    const linkButtons: ToolbarButton[] = [
        {
            icon: link_icon,
            description: "Create link",
            action: (): void => openLinkDialog(),
            active: (): boolean => isActive("link"),
        },
        {
            icon: copy_icon,
            description: "Quick copy",
            action: (): void =>
                run(() => editor!.chain().focus().toggleFastCopy().run()),
            active: (): boolean => isActive("fastCopy"),
        },
    ];

    type IconStyle = string;

    function getIconStyle(icon: string): IconStyle {
        return `--icon-url: url("${icon}")`;
    }

    let renameBackdropPointerStarted: boolean = false;
    let toolbarElement: HTMLDivElement | null = null;
    let toolbarInnerElement: HTMLDivElement | null = null;

    let floatingTitleWidth: number = $state(192);
    let showInlineRenameButton: boolean = $state(false);

    const toolbarEdgePadding: number = 12;
    const titleToolbarGap: number = 12;
    const maxFloatingTitleWidth: number = 192;
    const minFloatingTitleWidth: number = 96;

    function measureToolbarLayout(): void {
        if (!toolbarElement || !toolbarInnerElement) return;

        const toolbarWidth: number = toolbarElement.clientWidth;

        const toolbarButtonsWidth: number = Array.from(
            toolbarInnerElement.children,
        ).reduce((totalWidth: number, child: Element): number => {
            const element: HTMLElement = child as HTMLElement;
            return totalWidth + element.offsetWidth;
        }, 0);

        const buttonGapTotal: number =
            Math.max(toolbarInnerElement.children.length - 1, 0) * 5.6;

        const centeredToolbarWidth: number =
            toolbarButtonsWidth + buttonGapTotal;

        const freeLeftSpace: number =
            (toolbarWidth - centeredToolbarWidth) / 2 -
            toolbarEdgePadding -
            titleToolbarGap;

        if (freeLeftSpace < minFloatingTitleWidth) {
            showInlineRenameButton = true;
            floatingTitleWidth = 0;
            return;
        }

        showInlineRenameButton = false;
        floatingTitleWidth = Math.min(freeLeftSpace, maxFloatingTitleWidth);
    }
</script>

<svelte:head>
    <title>New note</title>
</svelte:head>

<div class="page">
    <div class="toolbar" bind:this={toolbarElement}>
        {#if !showInlineRenameButton}
            <button
                type="button"
                class="note-title-fake-input"
                style:width={`${floatingTitleWidth}px`}
                onclick={openRenameDialog}
                aria-label="Edit note title"
                title="Edit note title"
            >
                <span class="note-title-text">
                    {noteName.trim().length > 0 ? noteName : "Untitled note"}
                </span>

                <span class="note-title-icon" aria-hidden="true">✎</span>
            </button>
        {/if}
        <div class="toolbar-inner" bind:this={toolbarInnerElement}>
            {#if showInlineRenameButton}
                <button
                    type="button"
                    class="icon-button inline-rename-button"
                    onclick={openRenameDialog}
                    aria-label="Edit note title"
                    title="Edit note title"
                >
                    <span class="note-title-icon" aria-hidden="true">✎</span>
                </button>

                <div class="divider"></div>
            {/if}

            <div class="menu-wrap">
                <button
                    type="button"
                    class:active={openMenu === "heading"}
                    onclick={() => toggleMenu("heading")}
                    aria-label="Heading options"
                    title="Heading options"
                >
                    H
                </button>

                {#if openMenu === "heading"}
                    <div class="dropdown">
                        <button type="button" onclick={() => setHeading(1)}
                            >H1</button
                        >
                        <button type="button" onclick={() => setHeading(2)}
                            >H2</button
                        >
                        <button type="button" onclick={() => setHeading(3)}
                            >H3</button
                        >
                        <button type="button" onclick={() => setHeading(4)}
                            >H4</button
                        >
                    </div>
                {/if}
            </div>

            <div class="menu-wrap">
                <button
                    type="button"
                    class="icon-button"
                    class:active={openMenu === "list"}
                    onclick={() => toggleMenu("list")}
                    aria-label="List options"
                    title="List options"
                    ><span
                        class="icon-image toolbar-icon"
                        style={getIconStyle(bullet_list)}
                        aria-hidden="true"
                    ></span>
                </button>

                {#if openMenu === "list"}
                    <div class="dropdown">
                        <button
                            type="button"
                            onclick={toggleBulletList}
                            aria-label="Bullet list"
                            ><span
                                class="icon-image toolbar-icon"
                                style={getIconStyle(bullet_list)}
                                aria-hidden="true"
                            ></span></button
                        >
                        <button
                            type="button"
                            onclick={toggleOrderedList}
                            aria-label="Ordered list"
                            ><span
                                class="icon-image toolbar-icon"
                                style={getIconStyle(ordered_list)}
                                aria-hidden="true"
                            ></span></button
                        >
                        <button
                            type="button"
                            onclick={toggleTaskList}
                            aria-label="Task list"
                            ><span
                                class="icon-image toolbar-icon"
                                style={getIconStyle(task_list)}
                                aria-hidden="true"
                            ></span></button
                        >
                    </div>
                {/if}
            </div>

            <button
                type="button"
                class:active={isActive("blockquote")}
                class="icon-button"
                onclick={() =>
                    run(() => editor!.chain().focus().toggleBlockquote().run())}
                aria-label="Blockquote"
                title="Blockquote"
            >
                <span
                    class="icon-image toolbar-icon"
                    style={getIconStyle(backquote)}
                    aria-hidden="true"
                ></span>
            </button>

            <button
                type="button"
                class:active={isActive("codeBlock")}
                class="icon-button"
                onclick={() =>
                    run(() => editor!.chain().focus().toggleCodeBlock().run())}
                aria-label="Code block"
                title="Code block"
            >
                <span
                    class="icon-image toolbar-icon"
                    style={getIconStyle(code_block)}
                    aria-hidden="true"
                ></span>
            </button>

            <div class="divider"></div>

            {#each styleButtons as button}
                <button
                    type="button"
                    class:active={button.active?.()}
                    onclick={button.action}
                    aria-label={button.description}
                    title={button.description}
                >
                    <span
                        class:italic-label={button.label === "I"}
                        class:strike-label={button.label === "S"}
                        class:underline-label={button.label === "U"}
                    >
                        {button.label}
                    </span>
                </button>
            {/each}

            <div class="menu-wrap">
                <button
                    type="button"
                    class="icon-button"
                    class:active={openMenu === "textColor"}
                    onclick={() => toggleMenu("textColor")}
                    aria-label="Text color"
                    title="Text color"
                >
                    <span
                        class="icon-image toolbar-icon color-select-icon"
                        style={getIconStyle(color_select_icon)}
                        aria-hidden="true"
                    ></span>
                </button>

                {#if openMenu === "textColor"}
                    <div class="dropdown color-dropdown">
                        <div class="color-picker-row">
                            <div class="color-grid">
                                {#each textColorOptions.filter((option) => option.value.length > 0) as colorOption}
                                    <button
                                        type="button"
                                        class="color-option"
                                        onclick={() =>
                                            setTextColor(colorOption.value)}
                                        title={colorOption.label}
                                        aria-label={colorOption.label}
                                    >
                                        <span
                                            class="color-swatch"
                                            style:background={colorOption.value}
                                        ></span>
                                    </button>
                                {/each}
                            </div>

                            <button
                                type="button"
                                class="color-option clear-color-option"
                                onclick={() => setTextColor("")}
                                title="Clear"
                                aria-label="Clear"
                            >
                                <span
                                    class="icon-image clear-color-icon"
                                    style={getIconStyle(clear_icon)}
                                    aria-hidden="true"
                                ></span>
                            </button>
                        </div>
                    </div>
                {/if}
            </div>

            <div class="menu-wrap">
                <button
                    type="button"
                    class:active={openMenu === "highlightColor"}
                    onclick={() => toggleMenu("highlightColor")}
                    aria-label="Highlight color"
                    title="Highlight color"
                >
                    <span class="highlight-button-label">A</span>
                </button>

                {#if openMenu === "highlightColor"}
                    <div class="dropdown color-dropdown">
                        <div class="color-picker-row">
                            <div class="color-grid">
                                {#each highlightColorOptions.filter((option) => option.value.length > 0) as colorOption}
                                    <button
                                        type="button"
                                        class="color-option"
                                        onclick={() =>
                                            setHighlightColor(
                                                colorOption.value,
                                            )}
                                        title={colorOption.label}
                                        aria-label={colorOption.label}
                                    >
                                        <span
                                            class="color-swatch"
                                            style:background={colorOption.value}
                                        ></span>
                                    </button>
                                {/each}
                            </div>

                            <button
                                type="button"
                                class="color-option clear-color-option"
                                onclick={() => setHighlightColor("")}
                                title="Clear"
                                aria-label="Clear"
                            >
                                <img
                                    class="clear-color-icon"
                                    src={clear_icon}
                                    alt=""
                                />
                            </button>
                        </div>
                    </div>
                {/if}
            </div>
            <div class="divider"></div>

            {#each linkButtons as button}
                <button
                    type="button"
                    class:active={button.active?.()}
                    class="icon-button"
                    onclick={button.action}
                    aria-label={button.description}
                    title={button.description}
                >
                    {#if button.icon}
                        <span
                            class="icon-image toolbar-icon"
                            style={getIconStyle(button.icon)}
                            aria-hidden="true"
                        ></span>
                    {:else}
                        {button.label}
                    {/if}
                </button>
            {/each}

            <div class="divider"></div>

            <button
                type="button"
                class:active={isTextAlignActive("left")}
                class="icon-button"
                onclick={() =>
                    run(() =>
                        editor!.chain().focus().setTextAlign("left").run(),
                    )}
                aria-label="Align left"
                title="Align left"
            >
                <span
                    class="icon-image toolbar-icon"
                    style={getIconStyle(align_left)}
                    aria-hidden="true"
                ></span>
            </button>

            <button
                type="button"
                class:active={isTextAlignActive("center")}
                class="icon-button"
                onclick={() =>
                    run(() =>
                        editor!.chain().focus().setTextAlign("center").run(),
                    )}
                aria-label="Align center"
                title="Align center"
            >
                <span
                    class="icon-image toolbar-icon"
                    style={getIconStyle(align_center)}
                    aria-hidden="true"
                ></span>
            </button>

            <button
                type="button"
                class:active={isTextAlignActive("right")}
                class="icon-button"
                onclick={() =>
                    run(() =>
                        editor!.chain().focus().setTextAlign("right").run(),
                    )}
                aria-label="Align right"
                title="Align right"
            >
                <span
                    class="icon-image toolbar-icon"
                    style={getIconStyle(align_right)}
                    aria-hidden="true"
                ></span>
            </button>
        </div>
    </div>

    <div
        class="editor-shell"
        class:ctrl-link-hover={isModifierPressed && isHoveringLink}
        onclick={handleEditorAreaClick}
        onkeydown={(event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                handleEditorAreaClick();
            }
        }}
        role="button"
        tabindex="0"
    >
        <div bind:this={editorElement} class="editor-host"></div>
    </div>

    {#if hoveredLinkUrl}
        <div
            class="link-preview"
            role="tooltip"
            style:left={`${hoveredLinkLeft}px`}
            style:top={`${hoveredLinkTop}px`}
            onmouseenter={() => {
                clearHidePreviewTimeout();
                isHoveringPreview = true;
            }}
            onmouseleave={() => {
                isHoveringPreview = false;
                scheduleHideLinkPreview();
            }}
        >
            <button
                type="button"
                class="link-preview-copy"
                onclick={() => navigator.clipboard.writeText(hoveredLinkUrl!)}
            >
                Copy
            </button>

            <span class="link-preview-url">{hoveredLinkUrl}</span>
        </div>
    {/if}

    {#if isLinkDialogOpen}
        <LinkDialog
            isOpen={isLinkDialogOpen}
            initialType={linkDialogType}
            initialValue={linkDialogValue}
            currentNoteId={noteId}
            onClose={closeLinkDialog}
            onSubmit={submitLinkDialog}
            onRemove={removeLinkFromDialog}
        />
    {/if}

    {#if isRenameDialogOpen}
        <div
            class="dialog-backdrop"
            role="presentation"
            onmousedown={(event: MouseEvent): void => {
                renameBackdropPointerStarted =
                    event.target === event.currentTarget;
            }}
            onclick={(event: MouseEvent): void => {
                const endedOnBackdrop: boolean =
                    event.target === event.currentTarget;

                if (renameBackdropPointerStarted && endedOnBackdrop) {
                    closeRenameDialog();
                }

                renameBackdropPointerStarted = false;
            }}
        >
            <div
                class="rename-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="rename-dialog-title"
            >
                <h2 id="rename-dialog-title" class="rename-dialog-title">
                    Edit note title
                </h2>

                <label class="rename-field">
                    <span>Title</span>

                    <input
                        class="rename-input"
                        type="text"
                        bind:value={renameInput}
                        maxlength="120"
                        placeholder="Note title"
                        onkeydown={(event: KeyboardEvent): void => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                void submitRename();
                            }

                            if (event.key === "Escape") {
                                event.preventDefault();
                                closeRenameDialog();
                            }
                        }}
                    />
                </label>

                {#if renameError}
                    <span class="rename-error">{renameError}</span>
                {/if}

                <div class="rename-actions">
                    <button
                        type="button"
                        class="rename-primary-button"
                        onclick={() => void submitRename()}
                        disabled={isRenaming}
                    >
                        {isRenaming ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    :global(html),
    :global(body) {
        margin: 0;
        height: 100%;
    }

    :global(.tiptap-editor blockquote) {
        color: var(--color-text-muted);
    }

    :global(.tiptap-editor pre) {
        background: var(--color-titlebar-bg-strong);
        color: var(--color-text-strong);
    }

    :global(body) {
        overflow: hidden;
    }

    :global(#svelte) {
        height: 100%;
    }

    :global(.tiptap-editor .fast-copy) {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.02rem 0.2rem 0.02rem 0.12rem;
        border-radius: 0.4rem;
        color: var(--color-editor-link);
        vertical-align: baseline;
        transition:
            background 120ms ease,
            color 120ms ease;
    }

    :global(.tiptap-editor .fast-copy:hover) {
        background: var(--color-editor-link-bg);
    }

    :global(.tiptap-editor .fast-copy-icon) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1rem;
        height: 1rem;
        padding: 0;
        margin: 0;
        border: none;
        border-radius: 0.28rem;
        background: transparent;
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: 0.78rem;
        line-height: 1;
        flex: 0 0 auto;
        transform: translateY(0.2rem);
    }

    :global(.tiptap-editor .fast-copy-icon:hover) {
        background: var(--color-button-bg-hover);
        color: var(--color-editor-link-hover);
    }

    :global(.tiptap-editor .fast-copy-text) {
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 0.14rem;
        text-decoration-color: color-mix(
            in srgb,
            var(--color-editor-link) 70%,
            transparent
        );
    }

    :global(.tiptap-editor .fast-copy-text) {
        min-width: 0;
    }
    :global(.media-image-node) {
        position: relative;
        display: inline-block;
        max-width: 100%;
    }

    :global(.media-image-node img) {
        display: block;
        max-width: 100%;
        border-radius: 0.5rem;
    }

    :global(.media-image-node:hover img) {
        outline: 2px solid var(--color-editor-link-bg);
        outline-offset: 2px;
    }

    :global(.media-image-resize-handle) {
        position: absolute;
        right: 6px;
        bottom: 6px;
        width: 16px;
        height: 16px;

        display: flex;
        align-items: center;
        justify-content: center;

        color: var(--color-accent);
        background: var(--color-surface);
        border-radius: 4px;

        cursor: nwse-resize;
        z-index: 20;

        opacity: 0;
        pointer-events: none;
        transition: opacity 120ms ease;
    }

    :global(.media-image-node:hover .media-image-resize-handle) {
        opacity: 1;
        pointer-events: auto;
        transform: scale(1.1);
    }
    :global(.tiptap-editor) {
        outline: none;
        font-size: 16px;
        line-height: 1.65;
        min-height: 100%;
        box-sizing: border-box;
    }

    :global(.tiptap-editor > :first-child) {
        margin-top: 0;
    }

    :global(.tiptap-editor > :last-child) {
        margin-bottom: 0;
    }

    :global(.code-block-wrapper) {
        position: relative;
    }

    :global(.code-block-wrapper pre) {
        margin: 0;
        padding-top: 2.5rem;
    }

    :global(.code-block-copy-button) {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        z-index: 2;

        height: 1.8rem;
        min-width: auto;
        padding: 0.3rem 0.55rem;

        border: 1px solid var(--color-border);
        border-radius: var(--radius-button);
        background: var(--color-button-bg);
        color: var(--color-text);
        cursor: pointer;
    }

    :global(.code-block-copy-button:hover) {
        background: var(--color-button-bg-hover);
    }

    :global(.tiptap-editor .fast-copy-icon img) {
        width: 0.85rem;
        height: 0.85rem;
        display: block;
        pointer-events: none;
    }
    .page {
        height: 100%;
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        background: var(--color-bg-top);
        color: var(--color-text);
        overflow: visible;
    }

    .toolbar {
        position: sticky;
        top: 0;
        z-index: 30;

        position: relative;
        display: flex;
        justify-content: center;
        align-items: flex-start;

        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-surface);
        backdrop-filter: blur(var(--blur-bar));
    }

    .toolbar-inner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        flex-wrap: wrap;

        max-width: 100%;
        min-width: 0;
    }

    .menu-wrap {
        position: relative;
    }

    .divider {
        width: 1px;
        height: 1.4rem;
        background: var(--color-border);
        margin: 0 0.15rem;
    }

    button {
        border: 1px solid var(--color-border);
        background: var(--color-button-bg);
        color: var(--color-text);
        padding: 0.34rem 0.55rem;
        min-width: 2rem;
        height: 2rem;
        border-radius: var(--radius-button);
        font-size: 0.82rem;
        line-height: 1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        transition:
            background 120ms ease,
            border-color 120ms ease,
            color 120ms ease,
            box-shadow 120ms ease,
            transform 120ms ease;
    }

    button:hover {
        background: var(--color-button-bg-hover);
        border-color: var(--color-border-hover);
        box-shadow: var(--shadow-soft);
    }

    button:focus-visible {
        outline: none;
        border-color: var(--color-accent);
        box-shadow: 0 0 0 2px var(--color-editor-link-bg);
    }

    button.active {
        background: var(--color-editor-link-bg);
        color: var(--color-accent);
        border-color: var(--color-accent);
        box-shadow: var(--shadow-soft);
    }

    .dropdown {
        position: absolute;
        top: calc(100% + 0.4rem);
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.4rem;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-float);
        box-shadow: var(--shadow-float);
        backdrop-filter: blur(var(--blur-surface));
        z-index: 20;
    }

    .dropdown button:not(.color-option) {
        width: 100%;
        justify-content: flex-start;
        height: auto;
        padding: 0.5rem 0.65rem;
        font-size: 0.82rem;
    }

    .italic-label {
        font-style: italic;
    }

    .strike-label {
        text-decoration: line-through;
    }

    .underline-label {
        text-decoration: underline;
    }

    .editor-shell {
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        display: flex;
        flex-direction: column;
    }

    .editor-host {
        flex: 1 1 auto;
        min-height: 0;
        overflow: visible;
        padding: 1.25rem;
        box-sizing: border-box;
    }

    :global(.tiptap-editor) {
        outline: none;
        font-size: 16px;
        line-height: 1.65;
    }

    :global(.tiptap-editor h1) {
        font-size: 2rem;
        margin: 0 0 1rem 0;
    }

    :global(.tiptap-editor h2) {
        font-size: 1.5rem;
        margin: 0 0 0.875rem 0;
    }

    :global(.tiptap-editor h3) {
        font-size: 1.25rem;
        margin: 0 0 0.8rem 0;
    }

    :global(.tiptap-editor h4) {
        font-size: 1.1rem;
        margin: 0 0 0.75rem 0;
    }

    :global(.tiptap-editor p) {
        margin: 0 0 0.9rem 0;
    }

    :global(.tiptap-editor ul),
    :global(.tiptap-editor ol) {
        padding-left: 1.5rem;
        margin: 0 0 1rem 0;
    }

    :global(.tiptap-editor blockquote) {
        border-left: 3px solid #d1d5db;
        margin: 1rem 0;
        padding-left: 1rem;
        color: #4b5563;
    }

    :global(.tiptap-editor pre) {
        background: #111827;
        color: #f9fafb;
        padding: 0.9rem 1rem;
        border-radius: 0.75rem;
        overflow-x: auto;
    }

    :global(.tiptap-editor:focus) {
        outline: none;
    }
    :global(.tiptap-editor ul[data-type="taskList"]) {
        list-style: none;
        padding-left: 0;
        margin: 0 0 1rem 0;
    }

    :global(.tiptap-editor ul[data-type="taskList"] li) {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        margin: 0.25rem 0;
    }

    :global(.tiptap-editor ul[data-type="taskList"] li > label) {
        flex: 0 0 auto;
        margin: 0;
        padding-top: 0.15rem;
    }

    :global(.tiptap-editor ul[data-type="taskList"] li > div) {
        flex: 1 1 auto;
        min-width: 0;
    }

    :global(.tiptap-editor ul[data-type="taskList"] li p) {
        margin: 0;
    }

    :global(.tiptap-editor ul[data-type="taskList"] input[type="checkbox"]) {
        margin: 0;
    }
    :global(.tiptap-editor ul[data-type="taskList"]) {
        list-style: none;
        padding-left: 0;
        margin: 0 0 1rem 0;
    }

    :global(.tiptap-editor ul[data-type="taskList"] li) {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        margin: 0.25rem 0;
    }

    :global(.tiptap-editor ul[data-type="taskList"] li > label) {
        flex: 0 0 auto;
        margin: 0;
        padding-top: 0.15rem;
    }

    :global(.tiptap-editor ul[data-type="taskList"] li > div) {
        flex: 1 1 auto;
        min-width: 0;
    }

    :global(.tiptap-editor ul[data-type="taskList"] li p) {
        margin: 0;
    }

    :global(.tiptap-editor ul[data-type="taskList"] input[type="checkbox"]) {
        margin: 0;
    }
    :global(
            .tiptap-editor
                ul[data-type="taskList"]
                li:has(> div > p[style*="text-align: center"])
        ) {
        justify-content: center;
    }

    :global(
            .tiptap-editor
                ul[data-type="taskList"]
                li:has(> div > p[style*="text-align: right"])
        ) {
        justify-content: flex-end;
    }

    :global(
            .tiptap-editor
                ul[data-type="taskList"]
                li:has(> div > p[style*="text-align: left"])
        ) {
        justify-content: flex-start;
    }

    :global(
            .tiptap-editor
                ul[data-type="taskList"]
                li:has(> div > p[style*="text-align: center"])
                > div
        ) {
        flex: 0 1 auto;
    }

    :global(
            .tiptap-editor
                ul[data-type="taskList"]
                li:has(> div > p[style*="text-align: right"])
                > div
        ) {
        flex: 0 1 auto;
    }
    :global(.tiptap-editor h1) {
        color: var(--color-editor-heading-1);
    }

    :global(.tiptap-editor h2) {
        color: var(--color-editor-heading-2);
    }

    :global(.tiptap-editor h3) {
        color: var(--color-editor-heading-3);
    }

    :global(.tiptap-editor h4) {
        color: var(--color-editor-heading-4);
    }

    :global(.tiptap-editor ul li::marker),
    :global(.tiptap-editor ol li::marker) {
        color: var(--color-editor-list-marker);
    }

    :global(.tiptap-editor ul[data-type="taskList"] input[type="checkbox"]) {
        accent-color: var(--color-editor-task-check);
    }

    :global(.tiptap-editor blockquote) {
        border-left-color: var(--color-editor-blockquote-line);
    }

    :global(.tiptap-editor a) {
        color: var(--color-editor-link);
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
        border-radius: 0.25rem;
    }

    :global(.tiptap-editor a:hover) {
        color: var(--color-editor-link-hover);
        background: var(--color-editor-link-bg);
    }
    :global(.tiptap-editor a) {
        cursor: text;
    }

    .editor-shell.ctrl-link-hover :global(.tiptap-editor a:hover) {
        cursor: pointer;
    }

    .link-preview {
        position: fixed;
        z-index: 50;

        display: flex;
        align-items: center;
        gap: 0.5rem;

        padding: 0.45rem 0.6rem;
        border-radius: var(--radius-float);

        background: var(--color-surface);
        border: 1px solid var(--color-border);

        box-shadow: var(--shadow-soft);

        font-size: 0.78rem;
        color: var(--color-text);
    }

    .link-preview-copy {
        height: 1.8rem;
        padding: 0.3rem 0.55rem;

        border-radius: var(--radius-button);
        border: 1px solid var(--color-border);

        background: var(--color-button-bg);
        color: var(--color-text);
    }

    .link-preview-copy:hover {
        background: var(--color-button-bg-hover);
    }

    .link-preview-url {
        color: var(--color-text-muted);
    }

    .highlight-button-label {
        font-weight: 800;
        color: var(--color-text);
        background: color-mix(in srgb, var(--color-accent) 24%, transparent);
        border-radius: 0.25rem;
        padding: 0.05rem 0.18rem;
    }

    .color-dropdown {
        padding: 0.5rem;
    }

    .color-picker-row {
        display: flex;
        align-items: flex-start;
        gap: 0.55rem;
    }

    .color-grid {
        display: grid;
        grid-template-columns: repeat(5, 1.75rem);
        gap: 0.4rem;
    }

    .color-option {
        width: 28px !important;
        height: 28px !important;
        min-width: 28px !important;
        min-height: 28px !important;

        display: flex;
        align-items: center;
        justify-content: center;

        padding: 0 !important;
        border-radius: 999px;
    }

    .color-swatch {
        width: 16px;
        height: 16px;
        border-radius: 999px;

        display: block;
    }

    .color-option:hover {
        background: var(--color-button-bg-hover);
    }

    .color-swatch {
        border: 1px solid var(--color-border);
        box-shadow: none;
    }

    .clear-color-option {
        position: relative;
        flex: 0 0 auto;
        justify-content: center;
        align-items: center;
        border: none;
        background: transparent;
    }

    .toolbar-icon {
        width: 18px;
        height: 18px;
        pointer-events: none;
    }

    .clear-color-icon {
        width: 16px;
        height: 16px;
        pointer-events: none;
    }

    button:hover .icon-image {
        background-color: var(--color-heading);
    }

    button.active .icon-image {
        background-color: var(--color-accent);
    }

    .note-title-fake-input {
        position: absolute;
        left: 0.75rem;
        top: 0.5rem;
        z-index: 2;

        max-width: 12rem;
        min-width: 6rem;

        overflow: hidden;
        justify-content: space-between;
        padding: 0.34rem 0.65rem;
    }

    .note-title-text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .note-title-icon {
        flex: 0 0 auto;
        line-height: 1;
    }

    .inline-rename-button {
        width: 2rem;
        min-width: 2rem;
        padding: 0;
        justify-content: center;
    }
    .dialog-backdrop {
        position: fixed;
        inset: 0;
        z-index: 100;

        display: flex;
        align-items: center;
        justify-content: center;

        padding: 1rem;
        background: rgb(0 0 0 / 0.32);
    }

    .rename-dialog {
        width: min(100%, 24rem);
        border: 1px solid var(--color-border);
        border-radius: 1rem;
        background: var(--color-surface);
        box-shadow: var(--shadow-soft-hover);
        padding: 1rem;
        box-sizing: border-box;
    }

    .rename-dialog-title {
        margin: 0 0 1rem;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-title);
    }

    .rename-field {
        display: grid;
        gap: 0.35rem;
    }

    .rename-field span {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--color-text-muted);
    }

    .rename-input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--color-border);
        border-radius: 0.75rem;
        background: var(--color-surface);
        color: var(--color-text);
        padding: 0.7rem 0.85rem;
        font: inherit;
    }

    .rename-error {
        display: block;
        margin-top: 0.5rem;
        font-size: 0.78rem;
        color: var(--color-danger, #c62828);
    }

    .rename-actions {
        margin-top: 1rem;
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
    }

    .rename-primary-button {
        height: 2.25rem;
    }

    .rename-primary-button {
        border-color: var(--color-accent);
        background: var(--color-accent);
        color: white;
    }

    .rename-primary-button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
    }

    @media (max-width: 48rem) {
        .toolbar {
            padding-inline: 0.5rem;
        }

        .toolbar-inner {
            padding-inline: 2.5rem;
        }

        .note-title-fake-input {
            left: 0.5rem;
            width: 2rem;
            min-width: 2rem;
            max-width: 2rem;
            padding: 0;
            justify-content: center;
        }

        .note-title-text {
            display: none;
        }

        .note-title-icon {
            opacity: 1;
            margin: 0;
        }
    }
</style>

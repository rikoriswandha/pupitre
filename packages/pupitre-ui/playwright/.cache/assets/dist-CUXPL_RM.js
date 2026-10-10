import { Bn as wrappingInputRule, Bt as isNodeActive, Gn as keydownHandler, Ht as isNodeSelection, Jn as NodeSelection, Kn as Decoration, Mt as isAtStartOfNode, On as renderNestedMarkdownContent, Qn as TextSelection, Rn as textblockTypeInputRule, T as canInsertNode, Un as redo, Vn as history, Vt as isNodeEmpty, Wn as undo, Xn as PluginKey, Yn as Plugin, Zn as Selection$1, _n as mergeAttributes, bn as nodeInputRule, er as dropPoint, f as Mark, ft as getNodeType, it as getExtensionField, jt as isAtEndOfNode, m as Node, mn as markPasteRule, mt as getRenderedAttributes, nr as Slice, nt as getChangedRanges, pn as markInputRule, pt as getPreviousBlockSibling, qn as DecorationSet, s as Extension, tr as Fragment$1, ut as getNodeAtPosition, w as callOrReturn, wn as parseIndentedBlocks } from "./dist-D5N53XOC.js";
import { Link } from "./dist-D7mHrF_q.js";
//#region ../../node_modules/@tiptap/core/dist/jsx-runtime/jsx-runtime.js
var jsxElements = /* @__PURE__ */ new WeakSet();
var jsxFragments = /* @__PURE__ */ new WeakSet();
/** Create a new JSX element from the given spec */
function createJSXElement(spec) {
	const element = spec;
	jsxElements.add(element);
	return element;
}
/** Check if a spec is a JSX element */
function isJSXElement(value) {
	return Array.isArray(value) && jsxElements.has(value);
}
function flattenFragmentChildren(children) {
	return children.flatMap((child) => {
		if (child == null) return [];
		if (Array.isArray(child) && jsxFragments.has(child) && !isJSXElement(child)) return flattenFragmentChildren(child);
		return [child];
	});
}
function render(tag, attributes) {
	if (tag === "slot") return 0;
	if (tag instanceof Function) {
		const result = tag(attributes);
		if (Array.isArray(result) && !isJSXElement(result) && !jsxFragments.has(result)) return createJSXElement(result);
		return result;
	}
	const { children, ...rest } = attributes !== null && attributes !== void 0 ? attributes : {};
	if (tag === "svg") throw new Error("SVG elements are not supported in the JSX syntax, use the array syntax instead");
	if (Array.isArray(children)) {
		if (isJSXElement(children)) return createJSXElement([
			tag,
			rest,
			children
		]);
		if (children.length === 0) return createJSXElement([tag, rest]);
		const flattenedChildren = flattenFragmentChildren(children);
		if (flattenedChildren.length === 0) return createJSXElement([tag, rest]);
		return createJSXElement([
			tag,
			rest,
			...flattenedChildren
		]);
	}
	if (children !== void 0 && children !== null) return createJSXElement([
		tag,
		rest,
		children
	]);
	return createJSXElement([tag, rest]);
}
var h = (tag, attributes) => render(tag, attributes);
//#endregion
//#region ../../node_modules/@tiptap/extension-blockquote/dist/index.js
/**
* Restructure the blockquote boundary at the caret.
*
* Two cases are handled in a single backspace:
*
* 1. Caret at the start of a non-first child of a blockquote — lift the
*    current child out, splitting the blockquote around it.
* 2. Caret at the start of a top-level textblock whose previous sibling is
*    a blockquote with a textblock last child — merge the current
*    textblock's inline content into the blockquote's last textblock
*    instead of letting joinBackward pull the paragraph back inside.
*
* Returns true when the backspace was consumed.
*/
var handleBackspace$1 = (editor, type) => {
	var _previous$lastChild;
	const { state } = editor;
	const { selection } = state;
	if (!selection.empty) return false;
	const { $from } = selection;
	if ($from.parentOffset !== 0) return false;
	const parentDepth = $from.depth - 1;
	if (parentDepth < 0) return false;
	const parent = $from.node(parentDepth);
	const index = $from.index(parentDepth);
	if (index === 0) return false;
	if (parent.type === type) return editor.commands.lift(type.name);
	const previous = parent.child(index - 1);
	if (previous.type !== type || !((_previous$lastChild = previous.lastChild) === null || _previous$lastChild === void 0 ? void 0 : _previous$lastChild.isTextblock)) return false;
	const targetPos = $from.before() - 1 - 1;
	return editor.commands.command(({ tr, dispatch }) => {
		if (!dispatch) return true;
		const content = $from.parent.content;
		const slice = new Slice(content, 0, 0);
		tr.replace(targetPos, $from.after(), slice);
		tr.setSelection(TextSelection.create(tr.doc, targetPos + content.size));
		tr.scrollIntoView();
		dispatch(tr);
		return true;
	});
};
/** @jsxImportSource @tiptap/core */
/**
* Matches a blockquote to a `>` as input.
*/
var inputRegex$3 = /^\s*>\s$/;
/**
* This extension allows you to create blockquotes.
* @see https://tiptap.dev/api/nodes/blockquote
*/
var Blockquote = Node.create({
	name: "blockquote",
	addOptions() {
		return { HTMLAttributes: {} };
	},
	content: "block+",
	group: "block",
	defining: true,
	parseHTML() {
		return [{ tag: "blockquote" }];
	},
	renderHTML({ HTMLAttributes }) {
		return /* @__PURE__ */ h("blockquote", {
			...mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			children: /* @__PURE__ */ h("slot", {})
		});
	},
	parseMarkdown: (token, helpers) => {
		var _helpers$parseBlockCh;
		const parseBlockChildren = (_helpers$parseBlockCh = helpers.parseBlockChildren) !== null && _helpers$parseBlockCh !== void 0 ? _helpers$parseBlockCh : helpers.parseChildren;
		return helpers.createNode("blockquote", void 0, parseBlockChildren(token.tokens || []));
	},
	renderMarkdown: (node, h) => {
		if (!node.content) return "";
		const prefix = ">";
		const result = [];
		node.content.forEach((child, index) => {
			var _h$renderChild, _h$renderChild2;
			const linesWithPrefix = ((_h$renderChild = (_h$renderChild2 = h.renderChild) === null || _h$renderChild2 === void 0 ? void 0 : _h$renderChild2.call(h, child, index)) !== null && _h$renderChild !== void 0 ? _h$renderChild : h.renderChildren([child])).split("\n").map((line) => {
				if (line.trim() === "") return prefix;
				return `${prefix} ${line}`;
			});
			result.push(linesWithPrefix.join("\n"));
		});
		return result.join(`\n${prefix}\n`);
	},
	addCommands() {
		return {
			setBlockquote: () => ({ commands }) => {
				return commands.wrapIn(this.name);
			},
			toggleBlockquote: () => ({ commands }) => {
				return commands.toggleWrap(this.name);
			},
			unsetBlockquote: () => ({ commands }) => {
				return commands.lift(this.name);
			}
		};
	},
	addKeyboardShortcuts() {
		return {
			"Mod-Shift-b": () => this.editor.commands.toggleBlockquote(),
			Backspace: () => handleBackspace$1(this.editor, this.type)
		};
	},
	addInputRules() {
		return [wrappingInputRule({
			find: inputRegex$3,
			type: this.type
		})];
	}
});
//#endregion
//#region ../../node_modules/@tiptap/extension-bold/dist/index.js
/** @jsxImportSource @tiptap/core */
/**
* Matches bold text via `**` as input.
*/
var starInputRegex$1 = /(?:^|\s)(\*\*(?!\s+\*\*)((?:[^*]+))\*\*(?!\s+\*\*))$/;
/**
* Matches bold text via `**` while pasting.
*/
var starPasteRegex$1 = /(?:^|\s)(\*\*(?!\s+\*\*)((?:[^*]+))\*\*(?!\s+\*\*))/g;
/**
* Matches bold text via `__` as input.
*/
var underscoreInputRegex$1 = /(?:^|\s)(__(?!\s+__)((?:[^_]+))__(?!\s+__))$/;
/**
* Matches bold text via `__` while pasting.
*/
var underscorePasteRegex$1 = /(?:^|\s)(__(?!\s+__)((?:[^_]+))__(?!\s+__))/g;
/**
* This extension allows you to mark text as bold.
* @see https://tiptap.dev/api/marks/bold
*/
var Bold = Mark.create({
	name: "bold",
	addOptions() {
		return { HTMLAttributes: {} };
	},
	parseHTML() {
		return [
			{ tag: "strong" },
			{
				tag: "b",
				getAttrs: (node) => node.style.fontWeight !== "normal" && null
			},
			{
				style: "font-weight=400",
				clearMark: (mark) => mark.type.name === this.name
			},
			{
				style: "font-weight",
				getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		return /* @__PURE__ */ h("strong", {
			...mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			children: /* @__PURE__ */ h("slot", {})
		});
	},
	markdownTokenName: "strong",
	parseMarkdown: (token, helpers) => {
		return helpers.applyMark("bold", helpers.parseInline(token.tokens || []));
	},
	markdownOptions: { htmlReopen: {
		open: "<strong>",
		close: "</strong>"
	} },
	renderMarkdown: (node, h) => {
		return `**${h.renderChildren(node)}**`;
	},
	addCommands() {
		return {
			setBold: () => ({ commands }) => {
				return commands.setMark(this.name);
			},
			toggleBold: () => ({ commands }) => {
				return commands.toggleMark(this.name);
			},
			unsetBold: () => ({ commands }) => {
				return commands.unsetMark(this.name);
			}
		};
	},
	addKeyboardShortcuts() {
		return {
			"Mod-b": () => this.editor.commands.toggleBold(),
			"Mod-B": () => this.editor.commands.toggleBold()
		};
	},
	addInputRules() {
		return [markInputRule({
			find: starInputRegex$1,
			type: this.type
		}), markInputRule({
			find: underscoreInputRegex$1,
			type: this.type
		})];
	},
	addPasteRules() {
		return [markPasteRule({
			find: starPasteRegex$1,
			type: this.type
		}), markPasteRule({
			find: underscorePasteRegex$1,
			type: this.type
		})];
	}
});
/**
* A function-based finder for the inline code input rule.
* Used internally by the extension to ensure the preceding character
* is not consumed as part of the match, preventing it from being deleted.
*/
var inputRegexMatch = (text) => {
	const match = /`([^`]+)`(?!`)$/.exec(text);
	if (!match) return null;
	if (match.index > 0 && text[match.index - 1] === "`") return null;
	return {
		index: match.index,
		text: match[0],
		replaceWith: match[1]
	};
};
/**
* A function-based finder for the inline code paste rule.
* Used internally by the extension to avoid consuming the preceding
* character as part of the match.
*/
var pasteRegexMatch = (text) => {
	const regex = /`([^`]+)`(?!`)/g;
	const matches = [];
	let match;
	while ((match = regex.exec(text)) !== null) {
		if (match.index > 0 && text[match.index - 1] === "`") continue;
		matches.push({
			index: match.index,
			text: match[0],
			replaceWith: match[1]
		});
	}
	return matches;
};
function shortestUnusedBacktickRun(text) {
	const runs = new Set((text.match(/`+/g) || []).map((run) => run.length));
	let length = 1;
	while (runs.has(length)) length += 1;
	return length;
}
/**
* This extension allows you to mark text as inline code.
* @see https://tiptap.dev/api/marks/code
*/
var Code = Mark.create({
	name: "code",
	addOptions() {
		return { HTMLAttributes: {} };
	},
	excludes: "_",
	code: true,
	exitable: true,
	parseHTML() {
		return [{ tag: "code" }];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"code",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	markdownTokenName: "codespan",
	parseMarkdown: (token, helpers) => {
		return helpers.applyMark("code", [{
			type: "text",
			text: token.text || ""
		}]);
	},
	renderMarkdown: (node, h, context) => {
		var _context$meta;
		if (!node.content) return "";
		const markText = typeof (context === null || context === void 0 || (_context$meta = context.meta) === null || _context$meta === void 0 ? void 0 : _context$meta.markText) === "string" ? context.meta.markText : "";
		const fence = "`".repeat(shortestUnusedBacktickRun(markText));
		const padding = markText.startsWith("`") || markText.endsWith("`") ? " " : "";
		return `${fence}${padding}${h.renderChildren(node.content)}${padding}${fence}`;
	},
	addCommands() {
		return {
			setCode: () => ({ commands }) => {
				return commands.setMark(this.name);
			},
			toggleCode: () => ({ commands }) => {
				return commands.toggleMark(this.name);
			},
			unsetCode: () => ({ commands }) => {
				return commands.unsetMark(this.name);
			}
		};
	},
	addKeyboardShortcuts() {
		return { "Mod-e": () => this.editor.commands.toggleCode() };
	},
	addInputRules() {
		return [markInputRule({
			find: inputRegexMatch,
			type: this.type
		})];
	},
	addPasteRules() {
		return [markPasteRule({
			find: pasteRegexMatch,
			type: this.type
		})];
	}
});
//#endregion
//#region ../../node_modules/@tiptap/extension-code-block/dist/index.js
var DEFAULT_TAB_SIZE = 4;
/**
* Matches a code block with backticks.
*/
var backtickInputRegex = /^```([a-z]+)?[\s\n]$/;
/**
* Matches a code block with tildes.
*/
var tildeInputRegex = /^~~~([a-z]+)?[\s\n]$/;
/**
* This extension allows you to create code blocks.
* @see https://tiptap.dev/api/nodes/code-block
*/
var CodeBlock = Node.create({
	name: "codeBlock",
	addOptions() {
		return {
			languageClassPrefix: "language-",
			exitOnTripleEnter: true,
			exitOnArrowDown: true,
			exitOnArrowUp: true,
			defaultLanguage: null,
			enableTabIndentation: false,
			tabSize: DEFAULT_TAB_SIZE,
			HTMLAttributes: {}
		};
	},
	content: "text*",
	marks: "",
	group: "block",
	code: true,
	defining: true,
	addAttributes() {
		return { language: {
			default: this.options.defaultLanguage,
			parseHTML: (element) => {
				var _element$firstElement;
				const { languageClassPrefix } = this.options;
				if (!languageClassPrefix) return null;
				const language = [...((_element$firstElement = element.firstElementChild) === null || _element$firstElement === void 0 ? void 0 : _element$firstElement.classList) || []].filter((className) => className.startsWith(languageClassPrefix)).map((className) => className.replace(languageClassPrefix, ""))[0];
				if (!language) return null;
				return language;
			},
			rendered: false
		} };
	},
	parseHTML() {
		return [{
			tag: "pre",
			preserveWhitespace: "full"
		}];
	},
	renderHTML({ node, HTMLAttributes }) {
		return [
			"pre",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			[
				"code",
				{ class: node.attrs.language ? this.options.languageClassPrefix + node.attrs.language : null },
				0
			]
		];
	},
	markdownTokenName: "code",
	parseMarkdown: (token, helpers) => {
		var _token$raw, _token$raw2;
		if (((_token$raw = token.raw) === null || _token$raw === void 0 ? void 0 : _token$raw.startsWith("```")) === false && ((_token$raw2 = token.raw) === null || _token$raw2 === void 0 ? void 0 : _token$raw2.startsWith("~~~")) === false && token.codeBlockStyle !== "indented") return [];
		return helpers.createNode("codeBlock", { language: token.lang || null }, token.text ? [helpers.createTextNode(token.text)] : []);
	},
	renderMarkdown: (node, h) => {
		var _node$attrs;
		let output = "";
		const language = ((_node$attrs = node.attrs) === null || _node$attrs === void 0 ? void 0 : _node$attrs.language) || "";
		if (!node.content) output = `\`\`\`${language}\n\n\`\`\``;
		else output = [
			`\`\`\`${language}`,
			h.renderChildren(node.content),
			"```"
		].join("\n");
		return output;
	},
	addCommands() {
		return {
			setCodeBlock: (attributes) => ({ commands }) => {
				return commands.setNode(this.name, attributes);
			},
			toggleCodeBlock: (attributes) => ({ commands }) => {
				return commands.toggleNode(this.name, "paragraph", attributes);
			}
		};
	},
	addKeyboardShortcuts() {
		return {
			"Mod-Alt-c": () => this.editor.commands.toggleCodeBlock(),
			Backspace: () => {
				const { empty, $anchor } = this.editor.state.selection;
				const isAtStart = $anchor.pos === 1;
				if (!empty || $anchor.parent.type.name !== this.name) return false;
				if (isAtStart || !$anchor.parent.textContent.length) return this.editor.commands.clearNodes();
				return false;
			},
			Tab: ({ editor }) => {
				var _this$options$tabSize;
				if (!this.options.enableTabIndentation) return false;
				const tabSize = (_this$options$tabSize = this.options.tabSize) !== null && _this$options$tabSize !== void 0 ? _this$options$tabSize : DEFAULT_TAB_SIZE;
				const { state } = editor;
				const { selection } = state;
				const { $from, empty } = selection;
				if ($from.parent.type !== this.type) return false;
				const indent = " ".repeat(tabSize);
				if (empty) return editor.commands.insertContent(indent);
				return editor.commands.command(({ tr }) => {
					const { from, to } = selection;
					const indentedText = state.doc.textBetween(from, to, "\n", "\n").split("\n").map((line) => indent + line).join("\n");
					tr.replaceWith(from, to, state.schema.text(indentedText));
					return true;
				});
			},
			"Shift-Tab": ({ editor }) => {
				var _this$options$tabSize2;
				if (!this.options.enableTabIndentation) return false;
				const tabSize = (_this$options$tabSize2 = this.options.tabSize) !== null && _this$options$tabSize2 !== void 0 ? _this$options$tabSize2 : DEFAULT_TAB_SIZE;
				const { state } = editor;
				const { selection } = state;
				const { $from, empty } = selection;
				if ($from.parent.type !== this.type) return false;
				if (empty) return editor.commands.command(({ tr }) => {
					var _currentLine$match;
					const { pos } = $from;
					const codeBlockStart = $from.start();
					const codeBlockEnd = $from.end();
					const lines = state.doc.textBetween(codeBlockStart, codeBlockEnd, "\n", "\n").split("\n");
					let currentLineIndex = 0;
					let charCount = 0;
					const relativeCursorPos = pos - codeBlockStart;
					for (let i = 0; i < lines.length; i += 1) {
						if (charCount + lines[i].length >= relativeCursorPos) {
							currentLineIndex = i;
							break;
						}
						charCount += lines[i].length + 1;
					}
					const leadingSpaces = ((_currentLine$match = lines[currentLineIndex].match(/^ */)) === null || _currentLine$match === void 0 ? void 0 : _currentLine$match[0]) || "";
					const spacesToRemove = Math.min(leadingSpaces.length, tabSize);
					if (spacesToRemove === 0) return true;
					let lineStartPos = codeBlockStart;
					for (let i = 0; i < currentLineIndex; i += 1) lineStartPos += lines[i].length + 1;
					tr.delete(lineStartPos, lineStartPos + spacesToRemove);
					if (pos - lineStartPos <= spacesToRemove) tr.setSelection(TextSelection.create(tr.doc, lineStartPos));
					return true;
				});
				return editor.commands.command(({ tr }) => {
					const { from, to } = selection;
					const reverseIndentText = state.doc.textBetween(from, to, "\n", "\n").split("\n").map((line) => {
						var _line$match;
						const leadingSpaces = ((_line$match = line.match(/^ */)) === null || _line$match === void 0 ? void 0 : _line$match[0]) || "";
						const spacesToRemove = Math.min(leadingSpaces.length, tabSize);
						return line.slice(spacesToRemove);
					}).join("\n");
					tr.replaceWith(from, to, state.schema.text(reverseIndentText));
					return true;
				});
			},
			Enter: ({ editor }) => {
				if (!this.options.exitOnTripleEnter) return false;
				const { state } = editor;
				const { selection } = state;
				const { $from, empty } = selection;
				if (!empty || $from.parent.type !== this.type) return false;
				const isAtEnd = $from.parentOffset === $from.parent.nodeSize - 2;
				const endsWithDoubleNewline = $from.parent.textContent.endsWith("\n\n");
				if (!isAtEnd || !endsWithDoubleNewline) return false;
				return editor.chain().command(({ tr }) => {
					tr.delete($from.pos - 2, $from.pos);
					return true;
				}).exitCode().run();
			},
			ArrowUp: ({ editor }) => {
				if (!this.options.exitOnArrowUp) return false;
				const { state } = editor;
				const { selection } = state;
				const { $from, empty } = selection;
				if (!empty || $from.parent.type !== this.type) return false;
				if ($from.parentOffset !== 0) return false;
				const before = $from.before();
				if (before > 0) return false;
				return editor.commands.insertDefaultBlock({ pos: before });
			},
			ArrowDown: ({ editor }) => {
				if (!this.options.exitOnArrowDown) return false;
				const { state } = editor;
				const { selection, doc } = state;
				const { $from, empty } = selection;
				if (!empty || $from.parent.type !== this.type) return false;
				if (!($from.parentOffset === $from.parent.nodeSize - 2)) return false;
				const after = $from.after();
				if (after === void 0) return false;
				if (doc.nodeAt(after)) return editor.commands.command(({ tr }) => {
					tr.setSelection(Selection$1.near(doc.resolve(after)));
					return true;
				});
				return editor.commands.exitCode();
			}
		};
	},
	addInputRules() {
		return [textblockTypeInputRule({
			find: backtickInputRegex,
			type: this.type,
			getAttributes: (match) => ({ language: match[1] })
		}), textblockTypeInputRule({
			find: tildeInputRegex,
			type: this.type,
			getAttributes: (match) => ({ language: match[1] })
		})];
	},
	addProseMirrorPlugins() {
		return [new Plugin({
			key: new PluginKey("codeBlockVSCodeHandler"),
			props: { handlePaste: (view, event) => {
				if (!event.clipboardData) return false;
				if (this.editor.isActive(this.type.name)) return false;
				const text = event.clipboardData.getData("text/plain");
				const vscode = event.clipboardData.getData("vscode-editor-data");
				const vscodeData = vscode ? JSON.parse(vscode) : void 0;
				const language = vscodeData === null || vscodeData === void 0 ? void 0 : vscodeData.mode;
				if (!text || !language) return false;
				const { tr, schema } = view.state;
				const textNode = schema.text(text.replace(/\r\n?/g, "\n"));
				tr.replaceSelectionWith(this.type.create({ language }, textNode));
				if (tr.selection.$from.parent.type !== this.type) tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(0, tr.selection.from - 2))));
				tr.setMeta("paste", true);
				view.dispatch(tr);
				return true;
			} }
		})];
	}
});
//#endregion
//#region ../../node_modules/@tiptap/extension-document/dist/index.js
/**
* The default document node which represents the top level node of the editor.
* @see https://tiptap.dev/api/nodes/document
*/
var Document = Node.create({
	name: "doc",
	topNode: true,
	content: "block+",
	renderMarkdown: (node, h) => {
		if (!node.content) return "";
		return h.renderChildren(node.content, "\n\n");
	}
});
//#endregion
//#region ../../node_modules/@tiptap/extension-hard-break/dist/index.js
/**
* This extension allows you to insert hard breaks.
* @see https://www.tiptap.dev/api/nodes/hard-break
*/
var HardBreak = Node.create({
	name: "hardBreak",
	markdownTokenName: "br",
	addOptions() {
		return {
			keepMarks: true,
			HTMLAttributes: {}
		};
	},
	inline: true,
	group: "inline",
	selectable: false,
	linebreakReplacement: true,
	parseHTML() {
		return [{ tag: "br" }];
	},
	renderHTML({ HTMLAttributes }) {
		return ["br", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
	},
	renderText() {
		return "\n";
	},
	renderMarkdown: () => `  \n`,
	parseMarkdown: () => {
		return { type: "hardBreak" };
	},
	addCommands() {
		return { setHardBreak: () => ({ commands, chain, state, editor }) => {
			return commands.first([() => commands.exitCode(), () => commands.command(() => {
				const { selection, storedMarks } = state;
				if (selection.$from.parent.type.spec.isolating) return false;
				const { keepMarks } = this.options;
				const { splittableMarks } = editor.extensionManager;
				const marks = storedMarks || selection.$to.parentOffset && selection.$from.marks();
				return chain().insertContent({ type: this.name }).command(({ tr, dispatch }) => {
					if (dispatch && marks && keepMarks) {
						const filteredMarks = marks.filter((mark) => splittableMarks.includes(mark.type.name));
						tr.ensureMarks(filteredMarks);
					}
					return true;
				}).scrollIntoView().run();
			})]);
		} };
	},
	addKeyboardShortcuts() {
		return {
			"Mod-Enter": () => this.editor.commands.setHardBreak(),
			"Shift-Enter": () => this.editor.commands.setHardBreak()
		};
	}
});
//#endregion
//#region ../../node_modules/@tiptap/extension-heading/dist/index.js
/**
* This extension allows you to create headings.
* @see https://www.tiptap.dev/api/nodes/heading
*/
var Heading = Node.create({
	name: "heading",
	addOptions() {
		return {
			levels: [
				1,
				2,
				3,
				4,
				5,
				6
			],
			HTMLAttributes: {}
		};
	},
	content: "inline*",
	group: "block",
	defining: true,
	addAttributes() {
		return { level: {
			default: 1,
			rendered: false
		} };
	},
	parseHTML() {
		return this.options.levels.map((level) => ({
			tag: `h${level}`,
			attrs: { level }
		}));
	},
	renderHTML({ node, HTMLAttributes }) {
		return [
			`h${this.options.levels.includes(node.attrs.level) ? node.attrs.level : this.options.levels[0]}`,
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	parseMarkdown: (token, helpers) => {
		return helpers.createNode("heading", { level: token.depth || 1 }, helpers.parseInline(token.tokens || []));
	},
	renderMarkdown: (node, h) => {
		var _node$attrs;
		const level = ((_node$attrs = node.attrs) === null || _node$attrs === void 0 ? void 0 : _node$attrs.level) ? parseInt(node.attrs.level, 10) : 1;
		const headingChars = "#".repeat(level);
		if (!node.content) return "";
		return `${headingChars} ${h.renderChildren(node.content)}`;
	},
	addCommands() {
		return {
			setHeading: (attributes) => ({ commands }) => {
				if (!this.options.levels.includes(attributes.level)) return false;
				return commands.setNode(this.name, attributes);
			},
			toggleHeading: (attributes) => ({ commands }) => {
				if (!this.options.levels.includes(attributes.level)) return false;
				return commands.toggleNode(this.name, "paragraph", attributes);
			}
		};
	},
	addKeyboardShortcuts() {
		return this.options.levels.reduce((items, level) => ({
			...items,
			[`Mod-Alt-${level}`]: () => this.editor.commands.toggleHeading({ level })
		}), {});
	},
	addInputRules() {
		return this.options.levels.map((level) => {
			return textblockTypeInputRule({
				find: new RegExp(`^(#{${Math.min(...this.options.levels)},${level}})\\s$`),
				type: this.type,
				getAttributes: { level }
			});
		});
	}
});
//#endregion
//#region ../../node_modules/@tiptap/extension-horizontal-rule/dist/index.js
/**
* This extension allows you to insert horizontal rules.
* @see https://www.tiptap.dev/api/nodes/horizontal-rule
*/
var HorizontalRule = Node.create({
	name: "horizontalRule",
	addOptions() {
		return {
			HTMLAttributes: {},
			nextNodeType: "paragraph"
		};
	},
	group: "block",
	parseHTML() {
		return [{ tag: "hr" }];
	},
	renderHTML({ HTMLAttributes }) {
		return ["hr", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
	},
	markdownTokenName: "hr",
	parseMarkdown: (token, helpers) => {
		return helpers.createNode("horizontalRule");
	},
	renderMarkdown: () => {
		return "---";
	},
	addCommands() {
		return { setHorizontalRule: () => ({ chain, state }) => {
			if (!canInsertNode(state, state.schema.nodes[this.name])) return false;
			const { selection } = state;
			const { $to: $originTo } = selection;
			const currentChain = chain();
			if (isNodeSelection(selection)) currentChain.insertContentAt($originTo.pos, { type: this.name });
			else currentChain.insertContent({ type: this.name });
			return currentChain.command(({ state: chainState, tr, dispatch }) => {
				if (dispatch) {
					const { $to } = tr.selection;
					const posAfter = $to.end();
					if ($to.nodeAfter) {
						if ($to.nodeAfter.isTextblock) tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1));
						else if ($to.nodeAfter.isBlock) tr.setSelection(NodeSelection.create(tr.doc, $to.pos));
						else tr.setSelection(TextSelection.create(tr.doc, $to.pos));
					} else {
						const nodeType = chainState.schema.nodes[this.options.nextNodeType] || $to.parent.type.contentMatch.defaultType;
						const node = nodeType === null || nodeType === void 0 ? void 0 : nodeType.create();
						if (node) {
							tr.insert(posAfter, node);
							tr.setSelection(TextSelection.create(tr.doc, posAfter + 1));
						}
					}
					tr.scrollIntoView();
				}
				return true;
			}).run();
		} };
	},
	addInputRules() {
		return [nodeInputRule({
			find: /^(?:---|—-|___\s|\*\*\*\s)$/,
			type: this.type
		})];
	}
});
//#endregion
//#region ../../node_modules/@tiptap/extension-italic/dist/index.js
/**
* Matches an italic to a *italic* on input.
*/
var starInputRegex = /(?:^|\s)(\*(?!\s+\*)((?:[^*]+))\*(?!\s+\*))$/;
/**
* Matches an italic to a *italic* on paste.
*/
var starPasteRegex = /(?:^|\s)(\*(?!\s+\*)((?:[^*]+))\*(?!\s+\*))/g;
/**
* Matches an italic to a _italic_ on input.
*/
var underscoreInputRegex = /(?:^|\s)(_(?!\s+_)((?:[^_]+))_(?!\s+_))$/;
/**
* Matches an italic to a _italic_ on paste.
*/
var underscorePasteRegex = /(?:^|\s)(_(?!\s+_)((?:[^_]+))_(?!\s+_))/g;
/**
* This extension allows you to create italic text.
* @see https://www.tiptap.dev/api/marks/italic
*/
var Italic = Mark.create({
	name: "italic",
	addOptions() {
		return { HTMLAttributes: {} };
	},
	parseHTML() {
		return [
			{ tag: "em" },
			{
				tag: "i",
				getAttrs: (node) => node.style.fontStyle !== "normal" && null
			},
			{
				style: "font-style=normal",
				clearMark: (mark) => mark.type.name === this.name
			},
			{ style: "font-style=italic" }
		];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"em",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	addCommands() {
		return {
			setItalic: () => ({ commands }) => {
				return commands.setMark(this.name);
			},
			toggleItalic: () => ({ commands }) => {
				return commands.toggleMark(this.name);
			},
			unsetItalic: () => ({ commands }) => {
				return commands.unsetMark(this.name);
			}
		};
	},
	markdownTokenName: "em",
	parseMarkdown: (token, helpers) => {
		return helpers.applyMark("italic", helpers.parseInline(token.tokens || []));
	},
	markdownOptions: { htmlReopen: {
		open: "<em>",
		close: "</em>"
	} },
	renderMarkdown: (node, h) => {
		return `*${h.renderChildren(node)}*`;
	},
	addKeyboardShortcuts() {
		return {
			"Mod-i": () => this.editor.commands.toggleItalic(),
			"Mod-I": () => this.editor.commands.toggleItalic()
		};
	},
	addInputRules() {
		return [markInputRule({
			find: starInputRegex,
			type: this.type
		}), markInputRule({
			find: underscoreInputRegex,
			type: this.type
		})];
	},
	addPasteRules() {
		return [markPasteRule({
			find: starPasteRegex,
			type: this.type
		}), markPasteRule({
			find: underscorePasteRegex,
			type: this.type
		})];
	}
});
//#endregion
//#region ../../node_modules/@tiptap/extension-list/dist/index.js
var ListItemName$1 = "listItem";
var TextStyleName$1 = "textStyle";
/**
* Matches a bullet list to a dash or asterisk.
*/
var bulletListInputRegex = /^\s*([-+*])\s$/;
/**
* This extension allows you to create bullet lists.
* This requires the ListItem extension
* @see https://tiptap.dev/api/nodes/bullet-list
* @see https://tiptap.dev/api/nodes/list-item.
*/
var BulletList = Node.create({
	name: "bulletList",
	addOptions() {
		return {
			itemTypeName: "listItem",
			HTMLAttributes: {},
			keepMarks: false,
			keepAttributes: false
		};
	},
	group: "block list",
	content() {
		return `${this.options.itemTypeName}+`;
	},
	parseHTML() {
		return [{ tag: "ul" }];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"ul",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	markdownTokenName: "list",
	parseMarkdown: (token, helpers) => {
		if (token.type !== "list" || token.ordered) return [];
		return {
			type: "bulletList",
			content: token.items ? helpers.parseChildren(token.items) : []
		};
	},
	renderMarkdown: (node, h) => {
		if (!node.content) return "";
		return h.renderChildren(node.content, "\n");
	},
	markdownOptions: { indentsContent: true },
	addCommands() {
		return { toggleBulletList: () => ({ commands, chain }) => {
			if (this.options.keepAttributes) return chain().toggleList(this.name, this.options.itemTypeName, this.options.keepMarks).updateAttributes(ListItemName$1, this.editor.getAttributes(TextStyleName$1)).run();
			return commands.toggleList(this.name, this.options.itemTypeName, this.options.keepMarks);
		} };
	},
	addKeyboardShortcuts() {
		return { "Mod-Shift-8": () => this.editor.commands.toggleBulletList() };
	},
	addInputRules() {
		let inputRule = wrappingInputRule({
			find: bulletListInputRegex,
			type: this.type
		});
		if (this.options.keepMarks || this.options.keepAttributes) inputRule = wrappingInputRule({
			find: bulletListInputRegex,
			type: this.type,
			keepMarks: this.options.keepMarks,
			keepAttributes: this.options.keepAttributes,
			getAttributes: () => {
				return this.editor.getAttributes(TextStyleName$1);
			},
			editor: this.editor
		});
		return [inputRule];
	}
});
/**
* Resolves a branching nested list immediately after the cursor when the selection is
* collapsed at the end of a textblock inside a list item.
*
* @param state - The editor state to inspect.
* @param itemName - The list item node name (for example `listItem` or `taskItem`).
* @param wrapperNames - List wrapper node names (for example `bulletList` and `orderedList`).
* @returns Resolved positions and nodes for hoisting, or `null` when not applicable.
*
* @example
* ```ts
* const context = getBranchingNestedListAtCursor(editor.state, 'listItem', [
*   'bulletList',
*   'orderedList',
* ])
*
* if (context) {
*   // cursor is at the end of Item 1 before a branching nested sublist
* }
* ```
*/
var getBranchingNestedListAtCursor = (state, itemName, wrapperNames) => {
	const { selection } = state;
	if (!selection.empty) return null;
	const { $from } = selection;
	if (!$from.parent.isTextblock) return null;
	if ($from.parentOffset !== $from.parent.content.size) return null;
	let listItemDepth = -1;
	for (let depth = $from.depth; depth > 0; depth -= 1) if ($from.node(depth).type.name === itemName) {
		listItemDepth = depth;
		break;
	}
	if (listItemDepth < 0) return null;
	const listItem = $from.node(listItemDepth);
	const indexInListItem = $from.index(listItemDepth);
	if (indexInListItem + 1 >= listItem.childCount) return null;
	const nextChild = listItem.child(indexInListItem + 1);
	if (!wrapperNames.includes(nextChild.type.name)) return null;
	const itemType = state.schema.nodes[itemName];
	let hasBranching = false;
	nextChild.forEach((child) => {
		if (child.type === itemType && child.childCount > 1) hasBranching = true;
	});
	if (!hasBranching) return null;
	const nodeAfter = state.doc.resolve($from.after()).nodeAfter;
	if (!nodeAfter || !wrapperNames.includes(nodeAfter.type.name)) return null;
	const items = [];
	nodeAfter.forEach((child) => {
		items.push(child);
	});
	if (items.length === 0) return null;
	return {
		listItemDepth,
		nestedList: nodeAfter,
		nestedListPos: $from.after(),
		insertPos: $from.after(listItemDepth),
		items
	};
};
/**
* Hoists all list items from a branching nested list after the cursor into the parent list.
*
* Use this when `joinForward` cannot restructure a nested list that contains list items
* with sublists (see issue #6906).
*
* @param state - The editor state to transform.
* @param dispatch - Optional dispatch function for the transaction.
* @param itemName - The list item node name (for example `listItem` or `taskItem`).
* @param wrapperNames - List wrapper node names (for example `bulletList` and `orderedList`).
* @returns `true` when the nested list was hoisted, otherwise `false`.
*
* @example
* ```ts
* // Cursor at the end of "Item 1" before a nested list with branching items.
* hoistBranchingNestedList(editor.state, editor.view.dispatch, 'listItem', [
*   'bulletList',
*   'orderedList',
* ])
* ```
*/
var hoistBranchingNestedList = (state, dispatch, itemName, wrapperNames) => {
	const context = getBranchingNestedListAtCursor(state, itemName, wrapperNames);
	if (!context) return false;
	const { selection } = state;
	const { nestedList, nestedListPos, insertPos, items } = context;
	const tr = state.tr;
	tr.delete(nestedListPos, nestedListPos + nestedList.nodeSize);
	const mappedInsertPos = tr.mapping.map(insertPos);
	tr.insert(mappedInsertPos, Fragment$1.from(items));
	tr.setSelection(selection.map(tr.doc, tr.mapping));
	if (dispatch) dispatch(tr);
	return true;
};
/**
* Handles Delete for a list item when a branching nested sublist follows the cursor.
*
* @param editor - The editor instance whose state should be updated.
* @param itemName - The list item node name (for example `listItem` or `taskItem`).
* @param wrapperNames - List wrapper node names (for example `bulletList` and `orderedList`).
* @returns `true` when the nested list was hoisted, otherwise `false`.
*
* @example
* ```ts
* Delete: () =>
*   handleDeleteBranchingNestedList(editor, 'listItem', ['bulletList', 'orderedList']),
* ```
*/
var handleDeleteBranchingNestedList = (editor, itemName, wrapperNames) => {
	return hoistBranchingNestedList(editor.state, editor.view.dispatch, itemName, wrapperNames);
};
/**
* Creates a high-priority keymap extension that handles Delete for branching nested lists.
* Kept separate from the list item node so Enter/Tab shortcuts keep their default priority.
*/
var createBranchingListDeleteKeymap = (itemName, wrapperNames) => {
	return Extension.create({
		name: `${itemName}BranchingDeleteKeymap`,
		priority: 101,
		addKeyboardShortcuts() {
			const handleDelete = () => handleDeleteBranchingNestedList(this.editor, itemName, wrapperNames);
			return {
				Delete: handleDelete,
				"Mod-Delete": handleDelete
			};
		}
	});
};
var ROMAN_NUMERALS = [
	[1e3, "m"],
	[900, "cm"],
	[500, "d"],
	[400, "cd"],
	[100, "c"],
	[90, "xc"],
	[50, "l"],
	[40, "xl"],
	[10, "x"],
	[9, "ix"],
	[5, "v"],
	[4, "iv"],
	[1, "i"]
];
var ALPHA_NUMERALS = "abcdefghijklmnopqrstuvwxyz";
/**
* Marker segment for ordered list lines: numeric, roman, or 1–2 letter alpha.
* Roman is matched before alpha so "iii" is roman; invalid romans like "aa" fall through to alpha.
*/
var ORDERED_LIST_MARKER_PATTERN = String.raw`\d+|[ivxlcdmIVXLCDM]+|${"[a-zA-Z]{1,2}"}`;
/**
* Convert a number to lowercase roman numerals.
* @example toRoman(1) // 'i'
* @example toRoman(4) // 'iv'
*/
function toRoman(num) {
	let remaining = num;
	let result = "";
	for (const [value, numeral] of ROMAN_NUMERALS) while (remaining >= value) {
		result += numeral;
		remaining -= value;
	}
	return result;
}
/**
* Convert a number to uppercase roman numerals.
* @example toRomanUpper(1) // 'I'
* @example toRomanUpper(4) // 'IV'
*/
function toRomanUpper(num) {
	return toRoman(num).toUpperCase();
}
function fromRoman(roman) {
	const lower = roman.toLowerCase();
	let index = 0;
	let result = 0;
	while (index < lower.length) {
		let matched = false;
		for (const [value, numeral] of ROMAN_NUMERALS) if (lower.startsWith(numeral, index)) {
			result += value;
			index += numeral.length;
			matched = true;
			break;
		}
		if (!matched) return 0;
	}
	return result;
}
function isValidRoman(marker) {
	if (!/^[ivxlcdmIVXLCDM]+$/.test(marker)) return false;
	const value = fromRoman(marker);
	if (value <= 0) return false;
	return (marker === marker.toLowerCase() ? toRoman(value) : toRomanUpper(value)) === marker;
}
function fromAlpha(marker) {
	const lower = marker.toLowerCase();
	if (lower.length === 1) return lower.charCodeAt(0) - "a".charCodeAt(0) + 1;
	if (lower.length === 2) {
		const first = lower.charCodeAt(0) - "a".charCodeAt(0);
		const second = lower.charCodeAt(1) - "a".charCodeAt(0);
		return (first + 1) * 26 + second + 1;
	}
	return 0;
}
function toRomanAlpha(num) {
	if (num <= 26) return ALPHA_NUMERALS[num - 1];
	const first = Math.floor((num - 1) / 26) - 1;
	const second = (num - 1) % 26;
	if (first < 0) return ALPHA_NUMERALS[second];
	return ALPHA_NUMERALS[first] + ALPHA_NUMERALS[second];
}
/**
* Extract the list marker type from a marker string.
* Supports "1", "a", "A", "i", "I" marker styles.
*
* @param marker The text content of the list marker (e.g. "a", "1", "iii", "b")
* @returns The normalized type string, or undefined for default numeric type
*/
function detectMarkerType(marker) {
	if (!marker || /^\d+$/.test(marker)) return;
	if (isValidRoman(marker)) return marker === marker.toLowerCase() ? "i" : "I";
	if (/^[a-z]{1,2}$/.test(marker)) return "a";
	if (/^[A-Z]{1,2}$/.test(marker)) return "A";
}
/**
* Convert a list marker string to its numeric start position.
*
* @param marker The text content of the list marker (e.g. "3", "b", "II")
* @returns The 1-based start value for the ordered list
*/
function markerToStart(marker) {
	if (/^\d+$/.test(marker)) return parseInt(marker, 10);
	const type = detectMarkerType(marker);
	if (type === "i" || type === "I") return fromRoman(marker);
	if (type === "a" || type === "A") {
		const start = fromAlpha(marker);
		return start > 0 ? start : 1;
	}
	const parsed = parseInt(marker, 10);
	return Number.isNaN(parsed) ? 1 : parsed;
}
function startToMarker(type, start) {
	if (type === "numeric") return String(start);
	switch (type) {
		case "a": return toRomanAlpha(start);
		case "A": return toRomanAlpha(start).toUpperCase();
		case "i": return toRoman(start);
		case "I": return toRomanUpper(start);
		default: return String(start);
	}
}
/**
* Returns true when all markers share the same style and increment by 1.
* Style is inferred from the first marker so ambiguous letters (e.g. "c", "i")
* are not re-classified differently on later lines.
*/
function areOrderedListMarkersSequential(markers) {
	var _detectMarkerType;
	if (markers.length === 0) return false;
	const firstType = (_detectMarkerType = detectMarkerType(markers[0])) !== null && _detectMarkerType !== void 0 ? _detectMarkerType : "numeric";
	const firstStart = markerToStart(markers[0]);
	if (firstStart < 1) return false;
	for (let i = 0; i < markers.length; i++) {
		const expected = startToMarker(firstType, firstStart + i);
		if (markers[i] !== expected) return false;
	}
	return true;
}
/**
* Parse a list marker into HTML ordered-list attrs (type + start).
*/
function parseListMarker(marker) {
	return {
		type: detectMarkerType(marker),
		start: markerToStart(marker)
	};
}
/**
* Build orderedList node attrs from the first list item marker.
*/
function buildOrderedListAttrsFromMarker(marker) {
	const { type, start } = parseListMarker(marker);
	const attrs = {};
	if (type) attrs.type = type;
	if (start !== 1) attrs.start = start;
	return attrs;
}
/**
* Returns the list marker prefix for a given item at a given index.
*
* @param type The list type attribute (e.g. "a", "A", "i", "I", null/undefined for default)
* @param index The zero-based index of the list item
* @param separator The separator to use (default: ". ")
* @returns The marker string (e.g. "a. ", "I. ", "1. ")
*/
function getListMarker(type, index, separator = ". ") {
	const position = index + 1;
	if (!type || type === "1") return `${position}${separator}`;
	switch (type) {
		case "a": return `${toRomanAlpha(position)}${separator}`;
		case "A": return `${toRomanAlpha(position).toUpperCase()}${separator}`;
		case "i": return `${toRoman(position)}${separator}`;
		case "I": return `${toRomanUpper(position)}${separator}`;
		default: return `${position}${separator}`;
	}
}
function isSameLineOrderedListToken(token) {
	var _token$tokens, _token$tokens2;
	const nestedToken = (_token$tokens = token.tokens) === null || _token$tokens === void 0 ? void 0 : _token$tokens[0];
	return Boolean(token.text && ((_token$tokens2 = token.tokens) === null || _token$tokens2 === void 0 ? void 0 : _token$tokens2.length) === 1 && (nestedToken === null || nestedToken === void 0 ? void 0 : nestedToken.type) === "list" && nestedToken.ordered && nestedToken.raw === token.text);
}
function parseSameLineOrderedListText(text, helpers) {
	if (helpers.tokenizeInline) return helpers.parseInline(helpers.tokenizeInline(text));
	return helpers.parseInline([{
		type: "text",
		raw: text,
		text
	}]);
}
/**
* This extension allows you to create list items.
* @see https://www.tiptap.dev/api/nodes/list-item
*/
var ListItem = Node.create({
	name: "listItem",
	addOptions() {
		return {
			HTMLAttributes: {},
			bulletListTypeName: "bulletList",
			orderedListTypeName: "orderedList"
		};
	},
	content: "paragraph block*",
	defining: true,
	parseHTML() {
		return [{ tag: "li" }];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"li",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	markdownTokenName: "list_item",
	parseMarkdown: (token, helpers) => {
		var _helpers$parseBlockCh;
		if (token.type !== "list_item") return [];
		const parseBlockChildren = (_helpers$parseBlockCh = helpers.parseBlockChildren) !== null && _helpers$parseBlockCh !== void 0 ? _helpers$parseBlockCh : helpers.parseChildren;
		let content = [];
		if (token.tokens && token.tokens.length > 0) {
			if (isSameLineOrderedListToken(token)) return {
				type: "listItem",
				content: [{
					type: "paragraph",
					content: parseSameLineOrderedListText(token.text || "", helpers)
				}]
			};
			if (token.tokens.some((t) => t.type === "paragraph")) content = parseBlockChildren(token.tokens);
			else {
				const firstToken = token.tokens[0];
				if (firstToken && firstToken.type === "text" && firstToken.tokens && firstToken.tokens.length > 0) {
					content = [{
						type: "paragraph",
						content: helpers.parseInline(firstToken.tokens)
					}];
					if (token.tokens.length > 1) {
						const additionalContent = parseBlockChildren(token.tokens.slice(1));
						content.push(...additionalContent);
					}
				} else content = parseBlockChildren(token.tokens);
			}
		}
		if (content.length === 0) content = [{
			type: "paragraph",
			content: []
		}];
		return {
			type: "listItem",
			content
		};
	},
	renderMarkdown: (node, h, ctx) => {
		return renderNestedMarkdownContent(node, h, (context) => {
			if (context.parentType === "bulletList") return "- ";
			if (context.parentType === "orderedList") {
				var _context$meta, _context$meta2;
				const start = ((_context$meta = context.meta) === null || _context$meta === void 0 || (_context$meta = _context$meta.parentAttrs) === null || _context$meta === void 0 ? void 0 : _context$meta.start) || 1;
				return getListMarker((_context$meta2 = context.meta) === null || _context$meta2 === void 0 || (_context$meta2 = _context$meta2.parentAttrs) === null || _context$meta2 === void 0 ? void 0 : _context$meta2.type, start - 1 + (context.index || 0), ". ");
			}
			return "- ";
		}, ctx, { alignNestedToPrefix: (ctx === null || ctx === void 0 ? void 0 : ctx.parentType) === "orderedList" });
	},
	addExtensions() {
		return [createBranchingListDeleteKeymap(this.name, [this.options.bulletListTypeName, this.options.orderedListTypeName])];
	},
	addKeyboardShortcuts() {
		return {
			Enter: () => this.editor.commands.splitListItem(this.name),
			Tab: () => this.editor.commands.sinkListItem(this.name),
			"Shift-Tab": () => this.editor.commands.liftListItem(this.name)
		};
	}
});
var findListItemPos = (typeOrName, state) => {
	const { $from } = state.selection;
	const nodeType = getNodeType(typeOrName, state.schema);
	let currentNode = null;
	let currentDepth = $from.depth;
	let currentPos = $from.pos;
	let targetDepth = null;
	while (currentDepth > 0 && targetDepth === null) {
		currentNode = $from.node(currentDepth);
		if (currentNode.type === nodeType) targetDepth = currentDepth;
		else {
			currentDepth -= 1;
			currentPos -= 1;
		}
	}
	if (targetDepth === null) return null;
	return {
		$pos: state.doc.resolve(currentPos),
		depth: targetDepth
	};
};
var getNextListDepth = (typeOrName, state) => {
	const listItemPos = findListItemPos(typeOrName, state);
	if (!listItemPos) return false;
	const [, depth] = getNodeAtPosition(state, typeOrName, listItemPos.$pos.pos + 4);
	return depth;
};
var hasListBefore = (editorState, name, parentListTypes) => {
	const { $anchor } = editorState.selection;
	const previousNodePos = Math.max(0, $anchor.pos - 2);
	const previousNode = editorState.doc.resolve(previousNodePos).node();
	if (!previousNode || !parentListTypes.includes(previousNode.type.name)) return false;
	return true;
};
var handleBackspace = (editor, name, parentListTypes) => {
	if (editor.commands.undoInputRule()) return true;
	if (editor.state.selection.from !== editor.state.selection.to) return false;
	if (!isNodeActive(editor.state, name) && hasListBefore(editor.state, name, parentListTypes)) {
		const { $anchor } = editor.state.selection;
		const $listPos = editor.state.doc.resolve($anchor.before() - 1);
		const listDescendants = [];
		$listPos.node().descendants((node, pos) => {
			if (node.type.name === name) listDescendants.push({
				node,
				pos
			});
		});
		const lastItem = listDescendants.at(-1);
		if (!lastItem) return false;
		const $lastItemPos = editor.state.doc.resolve($listPos.start() + lastItem.pos + 1);
		return editor.chain().cut({
			from: $anchor.start() - 1,
			to: $anchor.end() + 1
		}, $lastItemPos.end()).joinForward().run();
	}
	if (!isNodeActive(editor.state, name)) return false;
	if (!isAtStartOfNode(editor.state)) return false;
	const { $from } = editor.state.selection;
	const itemDepth = $from.depth - 1;
	if ($from.node(itemDepth).type !== editor.schema.nodes[name] || $from.index(itemDepth) !== 0) return false;
	return editor.chain().liftListItem(name).run();
};
var nextListIsDeeper = (typeOrName, state) => {
	const listDepth = getNextListDepth(typeOrName, state);
	const listItemPos = findListItemPos(typeOrName, state);
	if (!listItemPos || !listDepth) return false;
	if (listDepth > listItemPos.depth) return true;
	return false;
};
var nextListIsHigher = (typeOrName, state) => {
	const listDepth = getNextListDepth(typeOrName, state);
	const listItemPos = findListItemPos(typeOrName, state);
	if (!listItemPos || !listDepth) return false;
	if (listDepth < listItemPos.depth) return true;
	return false;
};
var handleDelete = (editor, name) => {
	if (!isNodeActive(editor.state, name)) return false;
	if (!isAtEndOfNode(editor.state, name)) return false;
	const { selection } = editor.state;
	const { $from, $to } = selection;
	if (!selection.empty && $from.sameParent($to)) return false;
	if (nextListIsDeeper(name, editor.state)) return editor.chain().focus(editor.state.selection.from + 4).lift(name).joinBackward().run();
	if (nextListIsHigher(name, editor.state)) return editor.chain().joinForward().joinBackward().run();
	return editor.commands.joinItemForward();
};
var handleTab = (editor, name, parentListTypes) => {
	const { state } = editor;
	const { selection } = state;
	if (!selection.empty) return false;
	const { $from } = selection;
	if ($from.parentOffset !== 0) return false;
	if (!$from.parent.isTextblock) return false;
	if (isNodeActive(state, name)) return false;
	const previous = getPreviousBlockSibling($from);
	if (!previous || !parentListTypes.includes(previous.type.name)) return false;
	const lastItem = previous.lastChild;
	if (!lastItem || lastItem.type.name !== name) return false;
	const block = $from.parent;
	if (!lastItem.canReplace(lastItem.childCount, lastItem.childCount, Fragment$1.from(block))) return false;
	const blockStart = $from.before();
	const blockEnd = $from.after();
	const insideLastItemEnd = blockStart - 2;
	return editor.commands.command(({ tr, dispatch }) => {
		if (dispatch) {
			tr.delete(blockStart, blockEnd).insert(insideLastItemEnd, Fragment$1.from(block));
			tr.setSelection(TextSelection.create(tr.doc, insideLastItemEnd + 1));
			tr.scrollIntoView();
		}
		return true;
	});
};
/**
* This extension registers custom keymaps to change the behaviour of the backspace and delete keys.
* By default Prosemirror keyhandling will always lift or sink items so paragraphs are joined into
* the adjacent or previous list item. This extension will prevent this behaviour and instead will
* try to join paragraphs from two list items into a single list item.
* @see https://www.tiptap.dev/api/extensions/list-keymap
*/
var ListKeymap = Extension.create({
	name: "listKeymap",
	addOptions() {
		return { listTypes: [{
			itemName: "listItem",
			wrapperNames: ["bulletList", "orderedList"]
		}, {
			itemName: "taskItem",
			wrapperNames: ["taskList"]
		}] };
	},
	addKeyboardShortcuts() {
		return {
			Delete: ({ editor }) => {
				let handled = false;
				this.options.listTypes.forEach(({ itemName }) => {
					if (editor.state.schema.nodes[itemName] === void 0) return;
					if (handleDelete(editor, itemName)) handled = true;
				});
				return handled;
			},
			"Mod-Delete": ({ editor }) => {
				let handled = false;
				this.options.listTypes.forEach(({ itemName }) => {
					if (editor.state.schema.nodes[itemName] === void 0) return;
					if (handleDelete(editor, itemName)) handled = true;
				});
				return handled;
			},
			Backspace: ({ editor }) => {
				let handled = false;
				this.options.listTypes.forEach(({ itemName, wrapperNames }) => {
					if (editor.state.schema.nodes[itemName] === void 0) return;
					if (handleBackspace(editor, itemName, wrapperNames)) handled = true;
				});
				return handled;
			},
			"Mod-Backspace": ({ editor }) => {
				let handled = false;
				this.options.listTypes.forEach(({ itemName, wrapperNames }) => {
					if (editor.state.schema.nodes[itemName] === void 0) return;
					if (handleBackspace(editor, itemName, wrapperNames)) handled = true;
				});
				return handled;
			},
			Tab: ({ editor }) => {
				for (const { itemName, wrapperNames } of this.options.listTypes) {
					if (editor.state.schema.nodes[itemName] === void 0) continue;
					if (handleTab(editor, itemName, wrapperNames)) return true;
				}
				return false;
			}
		};
	}
});
/**
* Matches an ordered list item line with optional leading whitespace.
* Captures: (1) indentation spaces, (2) item marker (number, letter, or roman numeral),
* (3) separator (. or )), (4) content after marker
*
* Examples: "1. Item", "  a) Nested item", "    I. Roman item", "iii. Another", "aa. Item 27"
*/
var ORDERED_LIST_ITEM_REGEX = new RegExp(`^(\\s*)(${ORDERED_LIST_MARKER_PATTERN})([.)])\\s+(.*)$`);
/**
* Matches any line that starts with whitespace (indented content).
* Used to identify continuation content that belongs to a list item.
*/
var INDENTED_LINE_REGEX = /^\s/;
/**
* This are blocks that can interrupt a paragraph, so a line starting with one of
* them can never be lazy continuation text of a list item
*/
var PARAGRAPH_INTERRUPTERS = {
	heading: /^#{1,6}(?:\s|$)/,
	bulletItem: /^[-+*]\s+/,
	codeFence: /^(?:```|~~~)/,
	blockMath: /^\$\$/,
	thematicBreak: /^(?:(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})$/
};
function isOrderedListMarkerLine(line) {
	return ORDERED_LIST_ITEM_REGEX.test(line.trimStart());
}
function isBlockContentLine(line) {
	const trimmedLine = line.trimStart();
	return PARAGRAPH_INTERRUPTERS.bulletItem.test(trimmedLine) || isOrderedListMarkerLine(trimmedLine) || PARAGRAPH_INTERRUPTERS.heading.test(trimmedLine) || PARAGRAPH_INTERRUPTERS.thematicBreak.test(trimmedLine) && !trimmedLine.startsWith("-") || /^>\s?/.test(trimmedLine) || PARAGRAPH_INTERRUPTERS.codeFence.test(trimmedLine) || PARAGRAPH_INTERRUPTERS.blockMath.test(trimmedLine);
}
function interruptsLazyContinuation(line) {
	return Object.values(PARAGRAPH_INTERRUPTERS).some((pattern) => pattern.test(line));
}
function splitItemContent(contentLines) {
	const paragraphLines = [];
	const blockLines = [];
	let reachedBlockBoundary = false;
	contentLines.forEach((line) => {
		if (reachedBlockBoundary) {
			blockLines.push(line);
			return;
		}
		if (line.trim() === "") {
			reachedBlockBoundary = true;
			blockLines.push(line);
			return;
		}
		if (paragraphLines.length > 0 && isBlockContentLine(line)) {
			reachedBlockBoundary = true;
			blockLines.push(line);
			return;
		}
		paragraphLines.push(line);
	});
	return {
		paragraphLines,
		blockLines
	};
}
/**
* Collects all ordered list items from lines, parsing them into a flat array
* with indentation information. Stops collecting continuation content when
* encountering nested list items, allowing them to be processed separately.
*
* @param lines - Array of source lines to parse
* @returns Tuple of [listItems array, number of lines consumed]
*/
function collectOrderedListItems(lines) {
	const listItems = [];
	let currentLineIndex = 0;
	let consumed = 0;
	while (currentLineIndex < lines.length) {
		const line = lines[currentLineIndex];
		const match = line.match(ORDERED_LIST_ITEM_REGEX);
		if (!match) break;
		const [, indent, marker, _separator, content] = match;
		const indentLevel = indent.length;
		const number = parseInt(marker, 10);
		const markerType = isNaN(number) ? detectMarkerType(marker) : void 0;
		const itemNumber = isNaN(number) ? markerToStart(marker) : number;
		const itemContentLines = [content];
		let nextLineIndex = currentLineIndex + 1;
		const itemLines = [line];
		let sawBlankLine = false;
		while (nextLineIndex < lines.length) {
			const nextLine = lines[nextLineIndex];
			if (nextLine.match(ORDERED_LIST_ITEM_REGEX)) break;
			if (nextLine.trim() === "") {
				itemLines.push(nextLine);
				itemContentLines.push("");
				sawBlankLine = true;
				nextLineIndex += 1;
			} else if (nextLine.match(INDENTED_LINE_REGEX)) {
				const leadingWhitespace = nextLine.length - nextLine.trimStart().length;
				const contentIndent = indentLevel + marker.length + 1;
				itemLines.push(nextLine);
				itemContentLines.push(nextLine.slice(Math.min(leadingWhitespace, contentIndent)));
				nextLineIndex += 1;
			} else {
				if (sawBlankLine || interruptsLazyContinuation(nextLine)) break;
				itemLines.push(nextLine);
				itemContentLines.push(nextLine);
				nextLineIndex += 1;
			}
		}
		listItems.push({
			indent: indentLevel,
			number: itemNumber,
			type: markerType,
			content: itemContentLines.join("\n").trim(),
			contentLines: itemContentLines,
			raw: itemLines.join("\n")
		});
		consumed = nextLineIndex;
		currentLineIndex = nextLineIndex;
	}
	return [listItems, consumed];
}
var PLAIN_TEXT_ORDERED_LIST_LINE_REGEX = new RegExp(`^(${ORDERED_LIST_MARKER_PATTERN})([.)])\\s+(.+)$`);
/**
* Parse plain-text pasted ordered list lines into JSONContent, or null if not a typed list.
*/
function parsePlainTextOrderedListPaste(text) {
	const lines = text.split("\n").filter((l) => l.trim().length > 0);
	if (lines.length === 0) return null;
	const parsedItems = [];
	for (const line of lines) {
		const match = line.trim().match(PLAIN_TEXT_ORDERED_LIST_LINE_REGEX);
		if (!match) return null;
		parsedItems.push({
			marker: match[1],
			content: match[3]
		});
	}
	if (!areOrderedListMarkersSequential(parsedItems.map((item) => item.marker))) return null;
	return {
		type: "orderedList",
		attrs: buildOrderedListAttrsFromMarker(parsedItems[0].marker),
		content: parsedItems.map((item) => ({
			type: "listItem",
			content: [{
				type: "paragraph",
				content: [{
					type: "text",
					text: item.content
				}]
			}]
		}))
	};
}
/**
* Recursively builds a nested structure from a flat array of list items
* based on their indentation levels. Creates proper markdown tokens with
* nested lists where appropriate.
*
* @param items - Flat array of list items with indentation info
* @param baseIndent - The indentation level to process at this recursion level
* @param lexer - Markdown lexer for parsing inline and block content
* @returns Array of list_item tokens with proper nesting
*/
function buildNestedStructure(items, baseIndent, lexer) {
	const result = [];
	let currentIndex = 0;
	while (currentIndex < items.length) {
		const item = items[currentIndex];
		if (item.indent === baseIndent) {
			const { paragraphLines, blockLines } = splitItemContent(item.contentLines);
			const mainText = paragraphLines.join("\n").trim();
			const tokens = [];
			if (mainText) tokens.push({
				type: "paragraph",
				raw: mainText,
				tokens: lexer.inlineTokens(mainText)
			});
			const additionalContent = blockLines.join("\n").trim();
			if (additionalContent) {
				const blockTokens = lexer.blockTokens(additionalContent);
				tokens.push(...blockTokens);
			}
			let lookAheadIndex = currentIndex + 1;
			const nestedItems = [];
			while (lookAheadIndex < items.length && items[lookAheadIndex].indent > baseIndent) {
				nestedItems.push(items[lookAheadIndex]);
				lookAheadIndex += 1;
			}
			if (nestedItems.length > 0) {
				const nestedListItems = buildNestedStructure(nestedItems, Math.min(...nestedItems.map((nestedItem) => nestedItem.indent)), lexer);
				tokens.push({
					type: "list",
					ordered: true,
					start: nestedItems[0].number,
					typeMarker: nestedItems[0].type,
					items: nestedListItems,
					raw: nestedItems.map((nestedItem) => nestedItem.raw).join("\n")
				});
			}
			result.push({
				type: "list_item",
				raw: item.raw,
				tokens
			});
			currentIndex = lookAheadIndex;
		} else currentIndex += 1;
	}
	return result;
}
/**
* Parses markdown list item tokens into Tiptap JSONContent structure,
* ensuring text content is properly wrapped in paragraph nodes.
*
* @param items - Array of markdown tokens representing list items
* @param helpers - Markdown parse helpers for recursive parsing
* @returns Array of listItem JSONContent nodes
*/
function parseListItems(items, helpers) {
	return items.map((item) => {
		if (item.type !== "list_item") return helpers.parseChildren([item])[0];
		const content = [];
		if (item.tokens && item.tokens.length > 0) item.tokens.forEach((itemToken) => {
			if (itemToken.type === "paragraph" || itemToken.type === "list" || itemToken.type === "blockquote" || itemToken.type === "code") content.push(...helpers.parseChildren([itemToken]));
			else if (itemToken.type === "text" && itemToken.tokens) {
				const inlineContent = helpers.parseChildren([itemToken]);
				content.push({
					type: "paragraph",
					content: inlineContent
				});
			} else {
				const parsed = helpers.parseChildren([itemToken]);
				if (parsed.length > 0) content.push(...parsed);
			}
		});
		return {
			type: "listItem",
			content
		};
	});
}
var ORDERED_LIST_SCAN_WINDOW = 64;
function takeLines(source, max) {
	const lines = [];
	let start = 0;
	while (lines.length < max) {
		const lineEnd = source.indexOf("\n", start);
		if (lineEnd === -1) {
			lines.push(source.slice(start));
			return lines;
		}
		lines.push(source.slice(start, lineEnd));
		start = lineEnd + 1;
	}
	return lines;
}
/**
* Collect ordered list items from the start of `source`, reading only the lines the list needs.
*
* @param source Markdown beginning at a block boundary.
* @returns The items, how many lines they consumed, and the lines that were read.
* @example
*   collectOrderedListItemsFromSource('1. one\n2. two\n\nAfter')
*   // → [[item, item], 3, ['1. one', '2. two', '', 'After']]
*/
function collectOrderedListItemsFromSource(source) {
	const firstLineEnd = source.indexOf("\n");
	const firstLine = firstLineEnd === -1 ? source : source.slice(0, firstLineEnd);
	if (!ORDERED_LIST_ITEM_REGEX.test(firstLine)) return [
		[],
		0,
		[]
	];
	let windowSize = ORDERED_LIST_SCAN_WINDOW;
	let lines = takeLines(source, windowSize);
	let collected = collectOrderedListItems(lines);
	while (collected[1] === lines.length && lines.length === windowSize) {
		windowSize *= 2;
		lines = takeLines(source, windowSize);
		collected = collectOrderedListItems(lines);
	}
	return [
		collected[0],
		collected[1],
		lines
	];
}
var ListItemName = "listItem";
var TextStyleName = "textStyle";
/**
* Matches an ordered list to a 1. on input (or any number followed by a dot).
*/
var orderedListInputRegex = /^(\d+)\.\s$/;
/**
* Maps CSS list-style-type values to HTML type attribute values.
* Google Docs and Word often use CSS instead of the HTML type attribute.
*/
function cssListStyleTypeToHtmlType(style) {
	const match = style.match(/list-style-type\s*:\s*([^;]+)/i);
	if (!match) return null;
	switch (match[1].trim().toLowerCase()) {
		case "upper-roman": return "I";
		case "lower-roman": return "i";
		case "upper-alpha":
		case "upper-latin": return "A";
		case "lower-alpha":
		case "lower-latin": return "a";
		default: return null;
	}
}
/**
* This extension allows you to create ordered lists.
* This requires the ListItem extension
* @see https://www.tiptap.dev/api/nodes/ordered-list
* @see https://www.tiptap.dev/api/nodes/list-item
*/
var OrderedList = Node.create({
	name: "orderedList",
	addOptions() {
		return {
			itemTypeName: "listItem",
			HTMLAttributes: {},
			keepMarks: false,
			keepAttributes: false
		};
	},
	group: "block list",
	content() {
		return `${this.options.itemTypeName}+`;
	},
	addAttributes() {
		return {
			start: {
				default: 1,
				parseHTML: (element) => {
					return element.hasAttribute("start") ? parseInt(element.getAttribute("start") || "", 10) : 1;
				}
			},
			type: {
				default: null,
				parseHTML: (element) => {
					const htmlType = element.getAttribute("type");
					if (htmlType) return htmlType;
					const style = element.getAttribute("style");
					if (style) {
						const mappedFromOl = cssListStyleTypeToHtmlType(style);
						if (mappedFromOl) return mappedFromOl;
					}
					const firstLi = element.querySelector("li");
					if (firstLi) {
						const liStyle = firstLi.getAttribute("style");
						if (liStyle) {
							const mappedFromLi = cssListStyleTypeToHtmlType(liStyle);
							if (mappedFromLi) return mappedFromLi;
						}
					}
					return null;
				}
			}
		};
	},
	parseHTML() {
		return [{ tag: "ol" }];
	},
	renderHTML({ HTMLAttributes }) {
		const { start, type, ...attributesWithoutType } = HTMLAttributes;
		const attrs = mergeAttributes(this.options.HTMLAttributes, attributesWithoutType);
		if (start !== 1) attrs.start = start;
		if (type && type !== "1") attrs.type = type;
		return [
			"ol",
			attrs,
			0
		];
	},
	markdownTokenName: "list",
	parseMarkdown: (token, helpers) => {
		if (token.type !== "list" || !token.ordered) return [];
		const startValue = token.start || 1;
		const typeValue = token.typeMarker;
		const content = token.items ? parseListItems(token.items, helpers) : [];
		const attrs = {};
		if (startValue !== 1) attrs.start = startValue;
		if (typeValue) attrs.type = typeValue;
		if (Object.keys(attrs).length > 0) return {
			type: "orderedList",
			attrs,
			content
		};
		return {
			type: "orderedList",
			content
		};
	},
	renderMarkdown: (node, h) => {
		if (!node.content) return "";
		return h.renderChildren(node.content, "\n");
	},
	markdownTokenizer: {
		name: "orderedList",
		level: "block",
		start: () => -1,
		tokenize: (src, _tokens, lexer) => {
			var _listItems$, _listItems$2;
			const [listItems, consumed, lines] = collectOrderedListItemsFromSource(src);
			if (listItems.length === 0) return;
			const items = buildNestedStructure(listItems, listItems[0].indent, lexer);
			if (items.length === 0) return;
			return {
				type: "list",
				ordered: true,
				start: ((_listItems$ = listItems[0]) === null || _listItems$ === void 0 ? void 0 : _listItems$.number) || 1,
				typeMarker: (_listItems$2 = listItems[0]) === null || _listItems$2 === void 0 ? void 0 : _listItems$2.type,
				items,
				raw: lines.slice(0, consumed).join("\n")
			};
		}
	},
	markdownOptions: { indentsContent: true },
	addCommands() {
		return { toggleOrderedList: () => ({ commands, chain }) => {
			if (this.options.keepAttributes) return chain().toggleList(this.name, this.options.itemTypeName, this.options.keepMarks).updateAttributes(ListItemName, this.editor.getAttributes(TextStyleName)).run();
			return commands.toggleList(this.name, this.options.itemTypeName, this.options.keepMarks);
		} };
	},
	addKeyboardShortcuts() {
		return { "Mod-Shift-7": () => this.editor.commands.toggleOrderedList() };
	},
	addProseMirrorPlugins() {
		return [new Plugin({ props: { handlePaste: (view, event) => {
			var _event$clipboardData, _event$clipboardData2;
			const html = (_event$clipboardData = event.clipboardData) === null || _event$clipboardData === void 0 ? void 0 : _event$clipboardData.getData("text/html");
			if (html === null || html === void 0 ? void 0 : html.trim()) return false;
			const text = (_event$clipboardData2 = event.clipboardData) === null || _event$clipboardData2 === void 0 ? void 0 : _event$clipboardData2.getData("text/plain");
			if (!text) return false;
			const orderedListContent = parsePlainTextOrderedListPaste(text);
			if (!orderedListContent) return false;
			try {
				const orderedListNode = view.state.schema.nodeFromJSON(orderedListContent);
				const tr = view.state.tr.replaceSelectionWith(orderedListNode);
				view.dispatch(tr);
				return true;
			} catch {
				return false;
			}
		} } })];
	},
	addInputRules() {
		const joinPredicate = (match, node) => {
			return (!node.attrs.type || node.attrs.type === "1") && node.childCount + node.attrs.start === +match[1];
		};
		let inputRule = wrappingInputRule({
			find: orderedListInputRegex,
			type: this.type,
			getAttributes: (match) => ({ start: +match[1] }),
			joinPredicate
		});
		if (this.options.keepMarks || this.options.keepAttributes) inputRule = wrappingInputRule({
			find: orderedListInputRegex,
			type: this.type,
			keepMarks: this.options.keepMarks,
			keepAttributes: this.options.keepAttributes,
			getAttributes: (match) => ({
				start: +match[1],
				...this.editor.getAttributes(TextStyleName)
			}),
			joinPredicate,
			editor: this.editor
		});
		return [inputRule];
	}
});
/**
* Matches a task item to a - [ ] on input.
*/
var inputRegex$1 = /^\s*(\[([( |x])?\])\s$/;
/**
* Hides the checkbox label visually while keeping it in the accessibility tree.
*/
var visuallyHiddenStyle = "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";
var getCheckboxLabel = (node, checked, a11y) => {
	var _a11y$checkboxLabel;
	return (a11y === null || a11y === void 0 || (_a11y$checkboxLabel = a11y.checkboxLabel) === null || _a11y$checkboxLabel === void 0 ? void 0 : _a11y$checkboxLabel.call(a11y, node, checked)) || `Task item checkbox for ${node.textContent || "empty task item"}`;
};
/**
* This extension allows you to create task items.
* @see https://www.tiptap.dev/api/nodes/task-item
*/
var TaskItem = Node.create({
	name: "taskItem",
	addOptions() {
		return {
			nested: false,
			HTMLAttributes: {},
			taskListTypeName: "taskList",
			a11y: void 0
		};
	},
	content() {
		return this.options.nested ? "paragraph block*" : "paragraph+";
	},
	defining: true,
	addAttributes() {
		return { checked: {
			default: false,
			keepOnSplit: false,
			parseHTML: (element) => {
				const dataChecked = element.getAttribute("data-checked");
				return dataChecked === "" || dataChecked === "true";
			},
			renderHTML: (attributes) => ({ "data-checked": attributes.checked })
		} };
	},
	parseHTML() {
		return [{
			tag: `li[data-type="${this.name}"]`,
			priority: 51,
			contentElement: (element) => {
				var _element$querySelecto;
				return (_element$querySelecto = element.querySelector("div")) !== null && _element$querySelecto !== void 0 ? _element$querySelecto : element;
			}
		}];
	},
	renderHTML({ node, HTMLAttributes }) {
		return [
			"li",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { "data-type": this.name }),
			[
				"label",
				["input", {
					type: "checkbox",
					checked: node.attrs.checked ? "checked" : null
				}],
				["span"]
			],
			["div", 0]
		];
	},
	parseMarkdown: (token, h) => {
		const content = [];
		if (token.tokens && token.tokens.length > 0) content.push(h.createNode("paragraph", {}, h.parseInline(token.tokens)));
		else if (token.text) content.push(h.createNode("paragraph", {}, [h.createNode("text", { text: token.text })]));
		else content.push(h.createNode("paragraph", {}, []));
		if (token.nestedTokens && token.nestedTokens.length > 0) {
			const nestedContent = h.parseChildren(token.nestedTokens);
			content.push(...nestedContent);
		}
		return h.createNode("taskItem", { checked: token.checked || false }, content);
	},
	renderMarkdown: (node, h) => {
		var _node$attrs;
		const prefix = `- [${((_node$attrs = node.attrs) === null || _node$attrs === void 0 ? void 0 : _node$attrs.checked) ? "x" : " "}] `;
		return renderNestedMarkdownContent(node, h, prefix);
	},
	addExtensions() {
		if (!this.options.nested) return [];
		return [createBranchingListDeleteKeymap(this.name, [this.options.taskListTypeName])];
	},
	addKeyboardShortcuts() {
		const shortcuts = {
			Enter: () => this.editor.commands.splitListItem(this.name),
			"Shift-Tab": () => this.editor.commands.liftListItem(this.name)
		};
		if (!this.options.nested) return shortcuts;
		return {
			...shortcuts,
			Tab: () => this.editor.commands.sinkListItem(this.name)
		};
	},
	addNodeView() {
		return ({ node, HTMLAttributes, getPos, editor }) => {
			const listItem = document.createElement("li");
			const checkboxWrapper = document.createElement("label");
			const checkboxStyler = document.createElement("span");
			const checkbox = document.createElement("input");
			const content = document.createElement("div");
			checkboxStyler.style.cssText = visuallyHiddenStyle;
			const updateA11Y = (currentNode) => {
				const label = getCheckboxLabel(currentNode, currentNode.attrs.checked, this.options.a11y);
				checkbox.setAttribute("aria-label", label);
				checkboxStyler.textContent = label;
			};
			updateA11Y(node);
			checkboxWrapper.contentEditable = "false";
			checkbox.type = "checkbox";
			checkbox.addEventListener("mousedown", (event) => event.preventDefault());
			checkbox.addEventListener("change", (event) => {
				if (!editor.isEditable && !this.options.onReadOnlyChecked) {
					checkbox.checked = !checkbox.checked;
					return;
				}
				const { checked } = event.target;
				if (editor.isEditable && typeof getPos === "function") editor.chain().focus(void 0, { scrollIntoView: false }).command(({ tr }) => {
					const position = getPos();
					if (typeof position !== "number") return false;
					const currentNode = tr.doc.nodeAt(position);
					tr.setNodeMarkup(position, void 0, {
						...currentNode === null || currentNode === void 0 ? void 0 : currentNode.attrs,
						checked
					});
					return true;
				}).run();
				if (!editor.isEditable && this.options.onReadOnlyChecked) {
					if (!this.options.onReadOnlyChecked(node, checked)) checkbox.checked = !checkbox.checked;
				}
			});
			Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
				listItem.setAttribute(key, value);
			});
			listItem.dataset.checked = node.attrs.checked;
			checkbox.checked = node.attrs.checked;
			checkboxWrapper.append(checkbox, checkboxStyler);
			listItem.append(checkboxWrapper, content);
			Object.entries(HTMLAttributes).forEach(([key, value]) => {
				listItem.setAttribute(key, value);
			});
			let prevRenderedAttributeKeys = new Set(Object.keys(HTMLAttributes));
			return {
				dom: listItem,
				contentDOM: content,
				update: (updatedNode) => {
					if (updatedNode.type !== this.type) return false;
					listItem.dataset.checked = updatedNode.attrs.checked;
					checkbox.checked = updatedNode.attrs.checked;
					updateA11Y(updatedNode);
					const extensionAttributes = editor.extensionManager.attributes;
					const newHTMLAttributes = getRenderedAttributes(updatedNode, extensionAttributes);
					const newKeys = new Set(Object.keys(newHTMLAttributes));
					const staticAttrs = this.options.HTMLAttributes;
					prevRenderedAttributeKeys.forEach((key) => {
						if (!newKeys.has(key)) {
							if (key in staticAttrs) listItem.setAttribute(key, staticAttrs[key]);
							else listItem.removeAttribute(key);
						}
					});
					Object.entries(newHTMLAttributes).forEach(([key, value]) => {
						if (value === null || value === void 0) {
							if (key in staticAttrs) listItem.setAttribute(key, staticAttrs[key]);
							else listItem.removeAttribute(key);
						} else listItem.setAttribute(key, value);
					});
					prevRenderedAttributeKeys = newKeys;
					return true;
				}
			};
		};
	},
	addInputRules() {
		return [wrappingInputRule({
			find: inputRegex$1,
			type: this.type,
			getAttributes: (match) => ({ checked: match[match.length - 1] === "x" })
		})];
	}
});
/**
* This extension allows you to create task lists.
* @see https://www.tiptap.dev/api/nodes/task-list
*/
var TaskList = Node.create({
	name: "taskList",
	addOptions() {
		return {
			itemTypeName: "taskItem",
			HTMLAttributes: {}
		};
	},
	group: "block list",
	content() {
		return `${this.options.itemTypeName}+`;
	},
	parseHTML() {
		return [{
			tag: `ul[data-type="${this.name}"]`,
			priority: 51
		}];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"ul",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { "data-type": this.name }),
			0
		];
	},
	parseMarkdown: (token, h) => {
		return h.createNode("taskList", {}, h.parseChildren(token.items || []));
	},
	renderMarkdown: (node, h) => {
		if (!node.content) return "";
		return h.renderChildren(node.content, "\n");
	},
	markdownTokenizer: {
		name: "taskList",
		level: "block",
		start(src) {
			var _src$match;
			const index = (_src$match = src.match(/^\s*[-+*]\s+\[([ xX])\]\s+/)) === null || _src$match === void 0 ? void 0 : _src$match.index;
			return index !== void 0 ? index : -1;
		},
		tokenize(src, tokens, lexer) {
			const parseTaskListContent = (content) => {
				const nestedResult = parseIndentedBlocks(content, {
					itemPattern: /^(\s*)([-+*])\s+\[([ xX])\]\s+(.*)$/,
					extractItemData: (match) => ({
						indentLevel: match[1].length,
						mainContent: match[4],
						checked: match[3].toLowerCase() === "x"
					}),
					createToken: (data, nestedTokens) => ({
						type: "taskItem",
						raw: "",
						mainContent: data.mainContent,
						indentLevel: data.indentLevel,
						checked: data.checked,
						text: data.mainContent,
						tokens: lexer.inlineTokens(data.mainContent),
						nestedTokens
					}),
					customNestedParser: parseTaskListContent
				}, lexer);
				if (nestedResult) {
					const taskListToken = {
						type: "taskList",
						raw: nestedResult.raw,
						items: nestedResult.items
					};
					const remainder = content.slice(nestedResult.raw.length);
					if (remainder.trim()) return [taskListToken, ...lexer.blockTokens(remainder)];
					return [taskListToken];
				}
				return lexer.blockTokens(content);
			};
			const result = parseIndentedBlocks(src, {
				itemPattern: /^(\s*)([-+*])\s+\[([ xX])\]\s+(.*)$/,
				extractItemData: (match) => ({
					indentLevel: match[1].length,
					mainContent: match[4],
					checked: match[3].toLowerCase() === "x"
				}),
				createToken: (data, nestedTokens) => ({
					type: "taskItem",
					raw: "",
					mainContent: data.mainContent,
					indentLevel: data.indentLevel,
					checked: data.checked,
					text: data.mainContent,
					tokens: lexer.inlineTokens(data.mainContent),
					nestedTokens
				}),
				customNestedParser: parseTaskListContent
			}, lexer);
			if (!result) return;
			return {
				type: "taskList",
				raw: result.raw,
				items: result.items
			};
		}
	},
	markdownOptions: { indentsContent: true },
	addCommands() {
		return { toggleTaskList: () => ({ commands }) => {
			return commands.toggleList(this.name, this.options.itemTypeName);
		} };
	},
	addKeyboardShortcuts() {
		return { "Mod-Shift-9": () => this.editor.commands.toggleTaskList() };
	}
});
Extension.create({
	name: "listKit",
	addExtensions() {
		const extensions = [];
		if (this.options.bulletList !== false) extensions.push(BulletList.configure(this.options.bulletList));
		if (this.options.listItem !== false) extensions.push(ListItem.configure(this.options.listItem));
		if (this.options.listKeymap !== false) extensions.push(ListKeymap.configure(this.options.listKeymap));
		if (this.options.orderedList !== false) extensions.push(OrderedList.configure(this.options.orderedList));
		if (this.options.taskItem !== false) extensions.push(TaskItem.configure(this.options.taskItem));
		if (this.options.taskList !== false) extensions.push(TaskList.configure(this.options.taskList));
		return extensions;
	}
});
//#endregion
//#region ../../node_modules/@tiptap/extension-paragraph/dist/index.js
/**
* Markdown marker for empty paragraphs to preserve blank lines.
* Using &nbsp; (non-breaking space HTML entity) ensures the paragraph
* is not collapsed by markdown parsers while remaining human-readable.
*/
var EMPTY_PARAGRAPH_MARKDOWN = "&nbsp;";
/**
* Unicode character for non-breaking space (U+00A0).
* Some markdown parsers may convert &nbsp; entities to this literal character.
*/
var NBSP_CHAR = "\xA0";
/**
* This extension allows you to create paragraphs.
* @see https://www.tiptap.dev/api/nodes/paragraph
*/
var Paragraph = Node.create({
	name: "paragraph",
	priority: 1e3,
	addOptions() {
		return { HTMLAttributes: {} };
	},
	group: "block",
	content: "inline*",
	parseHTML() {
		return [{ tag: "p" }];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"p",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	parseMarkdown: (token, helpers) => {
		const tokens = token.tokens || [];
		if (tokens.length === 1 && tokens[0].type === "image") return helpers.parseChildren([tokens[0]]);
		const content = helpers.parseInline(tokens);
		if (tokens.length === 1 && tokens[0].type === "text" && (tokens[0].raw === EMPTY_PARAGRAPH_MARKDOWN || tokens[0].text === EMPTY_PARAGRAPH_MARKDOWN || tokens[0].raw === NBSP_CHAR || tokens[0].text === NBSP_CHAR) && content.length === 1 && content[0].type === "text" && (content[0].text === EMPTY_PARAGRAPH_MARKDOWN || content[0].text === NBSP_CHAR)) return helpers.createNode("paragraph", void 0, []);
		return helpers.createNode("paragraph", void 0, content);
	},
	renderMarkdown: (node, h, ctx) => {
		if (!node) return "";
		const content = Array.isArray(node.content) ? node.content : [];
		if (content.length === 0) {
			var _ctx$previousNode, _ctx$previousNode2;
			const previousContent = Array.isArray(ctx === null || ctx === void 0 || (_ctx$previousNode = ctx.previousNode) === null || _ctx$previousNode === void 0 ? void 0 : _ctx$previousNode.content) ? ctx.previousNode.content : [];
			return (ctx === null || ctx === void 0 || (_ctx$previousNode2 = ctx.previousNode) === null || _ctx$previousNode2 === void 0 ? void 0 : _ctx$previousNode2.type) === "paragraph" && previousContent.length === 0 ? EMPTY_PARAGRAPH_MARKDOWN : "";
		}
		return h.renderChildren(content);
	},
	addCommands() {
		return { setParagraph: () => ({ commands }) => {
			return commands.setNode(this.name);
		} };
	},
	addKeyboardShortcuts() {
		return { "Mod-Alt-0": () => this.editor.commands.setParagraph() };
	}
});
//#endregion
//#region ../../node_modules/@tiptap/extension-strike/dist/index.js
/**
* Matches a strike to a ~~strike~~ on input.
*/
var inputRegex = /(?:^|\s)(~~(?!\s+~~)((?:[^~]+))~~(?!\s+~~))$/;
/**
* Matches a strike to a ~~strike~~ on paste.
*/
var pasteRegex = /(?:^|\s)(~~(?!\s+~~)((?:[^~]+))~~(?!\s+~~))/g;
/**
* This extension allows you to create strike text.
* @see https://www.tiptap.dev/api/marks/strike
*/
var Strike = Mark.create({
	name: "strike",
	addOptions() {
		return { HTMLAttributes: {} };
	},
	parseHTML() {
		return [
			{ tag: "s" },
			{ tag: "del" },
			{ tag: "strike" },
			{
				style: "text-decoration",
				consuming: false,
				getAttrs: (style) => style.includes("line-through") ? {} : false
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"s",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	markdownTokenName: "del",
	parseMarkdown: (token, helpers) => {
		return helpers.applyMark("strike", helpers.parseInline(token.tokens || []));
	},
	renderMarkdown: (node, h) => {
		return `~~${h.renderChildren(node)}~~`;
	},
	addCommands() {
		return {
			setStrike: () => ({ commands }) => {
				return commands.setMark(this.name);
			},
			toggleStrike: () => ({ commands }) => {
				return commands.toggleMark(this.name);
			},
			unsetStrike: () => ({ commands }) => {
				return commands.unsetMark(this.name);
			}
		};
	},
	addKeyboardShortcuts() {
		return { "Mod-Shift-s": () => this.editor.commands.toggleStrike() };
	},
	addInputRules() {
		return [markInputRule({
			find: inputRegex,
			type: this.type
		})];
	},
	addPasteRules() {
		return [markPasteRule({
			find: pasteRegex,
			type: this.type
		})];
	}
});
//#endregion
//#region ../../node_modules/@tiptap/extension-text/dist/index.js
/**
* This extension allows you to create text nodes.
* @see https://www.tiptap.dev/api/nodes/text
*/
var Text = Node.create({
	name: "text",
	group: "inline",
	parseMarkdown: (token) => {
		return {
			type: "text",
			text: token.text || ""
		};
	},
	renderMarkdown: (node) => node.text || ""
});
//#endregion
//#region ../../node_modules/@tiptap/extension-underline/dist/index.js
/**
* This extension allows you to create underline text.
* @see https://www.tiptap.dev/api/marks/underline
*/
var Underline = Mark.create({
	name: "underline",
	addOptions() {
		return { HTMLAttributes: {} };
	},
	parseHTML() {
		return [{ tag: "u" }, {
			style: "text-decoration",
			consuming: false,
			getAttrs: (style) => style.includes("underline") ? {} : false
		}];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"u",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	parseMarkdown(token, helpers) {
		return helpers.applyMark(this.name || "underline", helpers.parseInline(token.tokens || []));
	},
	renderMarkdown(node, helpers) {
		return `++${helpers.renderChildren(node)}++`;
	},
	markdownTokenizer: {
		name: "underline",
		level: "inline",
		start(src) {
			return src.indexOf("++");
		},
		tokenize(src, _tokens, lexer) {
			const match = /^(\+\+)([\s\S]+?)(\+\+)/.exec(src);
			if (!match) return;
			const innerContent = match[2].trim();
			return {
				type: "underline",
				raw: match[0],
				text: innerContent,
				tokens: lexer.inlineTokens(innerContent)
			};
		}
	},
	addCommands() {
		return {
			setUnderline: () => ({ commands }) => {
				return commands.setMark(this.name);
			},
			toggleUnderline: () => ({ commands }) => {
				return commands.toggleMark(this.name);
			},
			unsetUnderline: () => ({ commands }) => {
				return commands.unsetMark(this.name);
			}
		};
	},
	addKeyboardShortcuts() {
		return {
			"Mod-u": () => this.editor.commands.toggleUnderline(),
			"Mod-U": () => this.editor.commands.toggleUnderline()
		};
	}
});
//#endregion
//#region ../../node_modules/prosemirror-dropcursor/dist/index.js
/**
Create a plugin that, when added to a ProseMirror instance,
causes a decoration to show up at the drop position when something
is dragged over the editor.

Nodes may add a `disableDropCursor` property to their spec to
control the showing of a drop cursor inside them. This may be a
boolean or a function, which will be called with a view and a
position, and should return a boolean.
*/
function dropCursor(options = {}) {
	return new Plugin({ view(editorView) {
		return new DropCursorView(editorView, options);
	} });
}
var DropCursorView = class {
	constructor(editorView, options) {
		var _a;
		this.editorView = editorView;
		this.cursorPos = null;
		this.element = null;
		this.timeout = -1;
		this.lastDragEvent = null;
		this.width = (_a = options.width) !== null && _a !== void 0 ? _a : 1;
		this.color = options.color === false ? void 0 : options.color || "black";
		this.class = options.class;
		this.handlers = [
			"dragover",
			"dragend",
			"drop",
			"dragleave"
		].map((name) => {
			let handler = (e) => {
				this[name](e);
			};
			editorView.dom.addEventListener(name, handler);
			return {
				name,
				handler
			};
		});
	}
	destroy() {
		this.setCursor(null);
		this.handlers.forEach(({ name, handler }) => this.editorView.dom.removeEventListener(name, handler));
	}
	update(editorView, prevState) {
		if (this.cursorPos != null && prevState.doc != editorView.state.doc) {
			if (this.lastDragEvent) {
				let target = this.computeTarget(this.lastDragEvent);
				if (target == this.cursorPos) this.updateOverlay();
				else this.setCursor(target);
			} else this.updateOverlay();
		}
	}
	setCursor(pos) {
		if (pos == this.cursorPos) return;
		this.cursorPos = pos;
		if (pos == null) {
			this.element.parentNode.removeChild(this.element);
			this.element = null;
		} else this.updateOverlay();
	}
	updateOverlay() {
		let $pos = this.editorView.state.doc.resolve(this.cursorPos);
		let isBlock = !$pos.parent.inlineContent, rect;
		let editorDOM = this.editorView.dom, editorRect = editorDOM.getBoundingClientRect();
		let scaleX = editorRect.width / editorDOM.offsetWidth, scaleY = editorRect.height / editorDOM.offsetHeight;
		if (isBlock) {
			let before = $pos.nodeBefore, after = $pos.nodeAfter;
			if (before || after) {
				let node = this.editorView.nodeDOM(this.cursorPos - (before ? before.nodeSize : 0));
				if (node) {
					let nodeRect = node.getBoundingClientRect();
					let top = before ? nodeRect.bottom : nodeRect.top;
					if (before && after) top = (top + this.editorView.nodeDOM(this.cursorPos).getBoundingClientRect().top) / 2;
					let halfWidth = this.width / 2 * scaleY;
					rect = {
						left: nodeRect.left,
						right: nodeRect.right,
						top: top - halfWidth,
						bottom: top + halfWidth
					};
				}
			}
		}
		if (!rect) {
			let coords = this.editorView.coordsAtPos(this.cursorPos);
			let halfWidth = this.width / 2 * scaleX;
			rect = {
				left: coords.left - halfWidth,
				right: coords.left + halfWidth,
				top: coords.top,
				bottom: coords.bottom
			};
		}
		let parent = this.editorView.dom.offsetParent;
		if (!this.element) {
			this.element = parent.appendChild(document.createElement("div"));
			if (this.class) this.element.className = this.class;
			this.element.style.cssText = "position: absolute; z-index: 50; pointer-events: none;";
			if (this.color) this.element.style.backgroundColor = this.color;
		}
		this.element.classList.toggle("prosemirror-dropcursor-block", isBlock);
		this.element.classList.toggle("prosemirror-dropcursor-inline", !isBlock);
		let parentLeft, parentTop;
		if (!parent || parent == document.body && getComputedStyle(parent).position == "static") {
			parentLeft = -pageXOffset;
			parentTop = -pageYOffset;
		} else {
			let rect = parent.getBoundingClientRect();
			let parentScaleX = rect.width / parent.offsetWidth, parentScaleY = rect.height / parent.offsetHeight;
			parentLeft = rect.left - parent.scrollLeft * parentScaleX;
			parentTop = rect.top - parent.scrollTop * parentScaleY;
		}
		this.element.style.left = (rect.left - parentLeft) / scaleX + "px";
		this.element.style.top = (rect.top - parentTop) / scaleY + "px";
		this.element.style.width = (rect.right - rect.left) / scaleX + "px";
		this.element.style.height = (rect.bottom - rect.top) / scaleY + "px";
	}
	scheduleRemoval(timeout) {
		clearTimeout(this.timeout);
		this.timeout = setTimeout(() => this.setCursor(null), timeout);
	}
	computeTarget(event) {
		let pos = this.editorView.posAtCoords({
			left: event.clientX,
			top: event.clientY
		});
		let node = pos && pos.inside >= 0 && this.editorView.state.doc.nodeAt(pos.inside);
		let disableDropCursor = node && node.type.spec.disableDropCursor;
		let disabled = typeof disableDropCursor == "function" ? disableDropCursor(this.editorView, pos, event) : disableDropCursor;
		if (!pos || disabled) return null;
		let target = pos.pos;
		if (this.editorView.dragging && this.editorView.dragging.slice) {
			let point = dropPoint(this.editorView.state.doc, target, this.editorView.dragging.slice);
			if (point != null) target = point;
		}
		return target;
	}
	dragover(event) {
		if (!this.editorView.editable) return;
		this.lastDragEvent = event;
		let target = this.computeTarget(event);
		if (target != null) {
			this.setCursor(target);
			this.scheduleRemoval(5e3);
		}
	}
	dragend() {
		this.scheduleRemoval(20);
	}
	drop() {
		this.scheduleRemoval(20);
	}
	dragleave(event) {
		if (!this.editorView.dom.contains(event.relatedTarget)) this.setCursor(null);
	}
};
//#endregion
//#region ../../node_modules/prosemirror-gapcursor/dist/index.js
/**
Gap cursor selections are represented using this class. Its
`$anchor` and `$head` properties both point at the cursor position.
*/
var GapCursor = class GapCursor extends Selection$1 {
	/**
	Create a gap cursor.
	*/
	constructor($pos) {
		super($pos, $pos);
	}
	map(doc, mapping) {
		let $pos = doc.resolve(mapping.map(this.head));
		return GapCursor.valid($pos) ? new GapCursor($pos) : Selection$1.near($pos);
	}
	content() {
		return Slice.empty;
	}
	eq(other) {
		return other instanceof GapCursor && other.head == this.head;
	}
	toJSON() {
		return {
			type: "gapcursor",
			pos: this.head
		};
	}
	/**
	@internal
	*/
	static fromJSON(doc, json) {
		if (typeof json.pos != "number") throw new RangeError("Invalid input for GapCursor.fromJSON");
		return new GapCursor(doc.resolve(json.pos));
	}
	/**
	@internal
	*/
	getBookmark() {
		return new GapBookmark(this.anchor);
	}
	/**
	@internal
	*/
	static valid($pos) {
		let parent = $pos.parent;
		if (parent.inlineContent || !closedBefore($pos) || !closedAfter($pos)) return false;
		let override = parent.type.spec.allowGapCursor;
		if (override != null) return override;
		let deflt = parent.contentMatchAt($pos.index()).defaultType;
		return deflt && deflt.isTextblock;
	}
	/**
	@internal
	*/
	static findGapCursorFrom($pos, dir, mustMove = false) {
		search: for (;;) {
			if (!mustMove && GapCursor.valid($pos)) return $pos;
			let pos = $pos.pos, next = null;
			for (let d = $pos.depth;; d--) {
				let parent = $pos.node(d);
				if (dir > 0 ? $pos.indexAfter(d) < parent.childCount : $pos.index(d) > 0) {
					next = parent.child(dir > 0 ? $pos.indexAfter(d) : $pos.index(d) - 1);
					break;
				} else if (d == 0) return null;
				pos += dir;
				let $cur = $pos.doc.resolve(pos);
				if (GapCursor.valid($cur)) return $cur;
			}
			for (;;) {
				let inside = dir > 0 ? next.firstChild : next.lastChild;
				if (!inside) {
					if (next.isAtom && !next.isText && !NodeSelection.isSelectable(next)) {
						$pos = $pos.doc.resolve(pos + next.nodeSize * dir);
						mustMove = false;
						continue search;
					}
					break;
				}
				next = inside;
				pos += dir;
				let $cur = $pos.doc.resolve(pos);
				if (GapCursor.valid($cur)) return $cur;
			}
			return null;
		}
	}
};
GapCursor.prototype.visible = false;
GapCursor.findFrom = GapCursor.findGapCursorFrom;
Selection$1.jsonID("gapcursor", GapCursor);
var GapBookmark = class GapBookmark {
	constructor(pos) {
		this.pos = pos;
	}
	map(mapping) {
		return new GapBookmark(mapping.map(this.pos));
	}
	resolve(doc) {
		let $pos = doc.resolve(this.pos);
		return GapCursor.valid($pos) ? new GapCursor($pos) : Selection$1.near($pos);
	}
};
function needsGap(type) {
	return type.isAtom || type.spec.isolating || type.spec.createGapCursor;
}
function closedBefore($pos) {
	for (let d = $pos.depth; d >= 0; d--) {
		let index = $pos.index(d), parent = $pos.node(d);
		if (index == 0) {
			if (parent.type.spec.isolating) return true;
			continue;
		}
		for (let before = parent.child(index - 1);; before = before.lastChild) {
			if (before.childCount == 0 && !before.inlineContent || needsGap(before.type)) return true;
			if (before.inlineContent) return false;
		}
	}
	return true;
}
function closedAfter($pos) {
	for (let d = $pos.depth; d >= 0; d--) {
		let index = $pos.indexAfter(d), parent = $pos.node(d);
		if (index == parent.childCount) {
			if (parent.type.spec.isolating) return true;
			continue;
		}
		for (let after = parent.child(index);; after = after.firstChild) {
			if (after.childCount == 0 && !after.inlineContent || needsGap(after.type)) return true;
			if (after.inlineContent) return false;
		}
	}
	return true;
}
/**
Create a gap cursor plugin. When enabled, this will capture clicks
near and arrow-key-motion past places that don't have a normally
selectable position nearby, and create a gap cursor selection for
them. The cursor is drawn as an element with class
`ProseMirror-gapcursor`. You can either include
`style/gapcursor.css` from the package's directory or add your own
styles to make it visible.
*/
function gapCursor() {
	return new Plugin({ props: {
		decorations: drawGapCursor,
		createSelectionBetween(_view, $anchor, $head) {
			return $anchor.pos == $head.pos && GapCursor.valid($head) ? new GapCursor($head) : null;
		},
		handleClick,
		handleKeyDown,
		handleDOMEvents: { beforeinput }
	} });
}
var handleKeyDown = keydownHandler({
	"ArrowLeft": arrow("horiz", -1),
	"ArrowRight": arrow("horiz", 1),
	"ArrowUp": arrow("vert", -1),
	"ArrowDown": arrow("vert", 1)
});
function arrow(axis, dir) {
	const dirStr = axis == "vert" ? dir > 0 ? "down" : "up" : dir > 0 ? "right" : "left";
	return function(state, dispatch, view) {
		let sel = state.selection;
		let $start = dir > 0 ? sel.$to : sel.$from, mustMove = sel.empty;
		if (sel instanceof TextSelection) {
			if (!view.endOfTextblock(dirStr) || $start.depth == 0) return false;
			mustMove = false;
			$start = state.doc.resolve(dir > 0 ? $start.after() : $start.before());
		}
		let $found = GapCursor.findGapCursorFrom($start, dir, mustMove);
		if (!$found) return false;
		if (dispatch) dispatch(state.tr.setSelection(new GapCursor($found)));
		return true;
	};
}
function handleClick(view, pos, event) {
	if (!view || !view.editable) return false;
	let $pos = view.state.doc.resolve(pos);
	if (!GapCursor.valid($pos)) return false;
	let clickPos = view.posAtCoords({
		left: event.clientX,
		top: event.clientY
	});
	if (clickPos && clickPos.inside > -1 && NodeSelection.isSelectable(view.state.doc.nodeAt(clickPos.inside))) return false;
	view.dispatch(view.state.tr.setSelection(new GapCursor($pos)));
	return true;
}
function beforeinput(view, event) {
	if (event.inputType != "insertCompositionText" || !(view.state.selection instanceof GapCursor)) return false;
	let { $from } = view.state.selection;
	let insert = $from.parent.contentMatchAt($from.index()).findWrapping(view.state.schema.nodes.text);
	if (!insert) return false;
	let frag = Fragment$1.empty;
	for (let i = insert.length - 1; i >= 0; i--) frag = Fragment$1.from(insert[i].createAndFill(null, frag));
	let tr = view.state.tr.replace($from.pos, $from.pos, new Slice(frag, 0, 0));
	tr.setSelection(TextSelection.near(tr.doc.resolve($from.pos + 1)));
	view.dispatch(tr);
	return false;
}
function drawGapCursor(state) {
	if (!(state.selection instanceof GapCursor)) return null;
	let node = document.createElement("div");
	node.className = "ProseMirror-gapcursor";
	return DecorationSet.create(state.doc, [Decoration.widget(state.selection.head, node, { key: "gapcursor" })]);
}
Extension.create({
	name: "characterCount",
	addOptions() {
		return {
			limit: null,
			autoTrim: true,
			mode: "textSize",
			textCounter: (text) => text.length,
			wordCounter: (text) => text.split(" ").filter((word) => word !== "").length
		};
	},
	addStorage() {
		return {
			characters: () => 0,
			words: () => 0
		};
	},
	onBeforeCreate() {
		this.storage.characters = (options) => {
			const node = (options === null || options === void 0 ? void 0 : options.node) || this.editor.state.doc;
			if (((options === null || options === void 0 ? void 0 : options.mode) || this.options.mode) === "textSize") {
				const text = node.textBetween(0, node.content.size, void 0, " ");
				return this.options.textCounter(text);
			}
			return node.nodeSize;
		};
		this.storage.words = (options) => {
			const node = (options === null || options === void 0 ? void 0 : options.node) || this.editor.state.doc;
			const text = node.textBetween(0, node.content.size, " ", " ");
			return this.options.wordCounter(text);
		};
	},
	addProseMirrorPlugins() {
		let initialEvaluationDone = false;
		return [new Plugin({
			key: new PluginKey("characterCount"),
			appendTransaction: (transactions, oldState, newState) => {
				if (initialEvaluationDone) return;
				const limit = this.options.limit;
				const autoTrim = this.options.autoTrim;
				if (limit === null || limit === void 0 || limit === 0 || autoTrim === false) {
					initialEvaluationDone = true;
					return;
				}
				const initialContentSize = this.storage.characters({ node: newState.doc });
				if (initialContentSize > limit) {
					const over = initialContentSize - limit;
					const from = 0;
					const to = over;
					console.warn(`[CharacterCount] Initial content exceeded limit of ${limit} characters. Content was automatically trimmed.`);
					const tr = newState.tr.deleteRange(from, to);
					initialEvaluationDone = true;
					return tr;
				}
				initialEvaluationDone = true;
			},
			filterTransaction: (transaction, state) => {
				const limit = this.options.limit;
				if (!transaction.docChanged || limit === 0 || limit === null || limit === void 0) return true;
				const oldSize = this.storage.characters({ node: state.doc });
				const newSize = this.storage.characters({ node: transaction.doc });
				if (newSize <= limit) return true;
				if (oldSize > limit && newSize > limit && newSize <= oldSize) return true;
				if (oldSize > limit && newSize > limit && newSize > oldSize) return false;
				if (!transaction.getMeta("paste")) return false;
				const pos = transaction.selection.$head.pos;
				const from = pos - (newSize - limit);
				const to = pos;
				transaction.deleteRange(from, to);
				if (this.storage.characters({ node: transaction.doc }) > limit) return false;
				return true;
			}
		})];
	}
});
/**
* This extension allows you to add a drop cursor to your editor.
* A drop cursor is a line that appears when you drag and drop content
* in-between nodes.
* @see https://tiptap.dev/api/extensions/dropcursor
*/
var Dropcursor = Extension.create({
	name: "dropCursor",
	addOptions() {
		return {
			color: "currentColor",
			width: 1,
			class: void 0
		};
	},
	addProseMirrorPlugins() {
		return [dropCursor(this.options)];
	}
});
Extension.create({
	name: "focus",
	addOptions() {
		return {
			className: "has-focus",
			mode: "all"
		};
	},
	addProseMirrorPlugins() {
		return [new Plugin({
			key: new PluginKey("focus"),
			props: { decorations: ({ doc, selection }) => {
				const { isEditable, isFocused } = this.editor;
				const { anchor } = selection;
				const decorations = [];
				if (!isEditable || !isFocused) return DecorationSet.create(doc, []);
				let maxLevels = 0;
				if (this.options.mode === "deepest") doc.descendants((node, pos) => {
					if (node.isText) return;
					if (!(anchor >= pos && anchor <= pos + node.nodeSize - 1)) return false;
					maxLevels += 1;
				});
				let currentLevel = 0;
				doc.descendants((node, pos) => {
					if (node.isText) return false;
					if (!(anchor >= pos && anchor <= pos + node.nodeSize - 1)) return false;
					currentLevel += 1;
					if (this.options.mode === "deepest" && maxLevels - currentLevel > 0 || this.options.mode === "shallowest" && currentLevel > 1) return this.options.mode === "deepest";
					decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: this.options.className }));
				});
				return DecorationSet.create(doc, decorations);
			} }
		})];
	}
});
/**
* This extension allows you to add a gap cursor to your editor.
* A gap cursor is a cursor that appears when you click on a place
* where no content is present, for example inbetween nodes.
* @see https://tiptap.dev/api/extensions/gapcursor
*/
var Gapcursor = Extension.create({
	name: "gapCursor",
	addProseMirrorPlugins() {
		return [gapCursor()];
	},
	extendNodeSchema(extension) {
		var _callOrReturn;
		const context = {
			name: extension.name,
			options: extension.options,
			storage: extension.storage
		};
		return { allowGapCursor: (_callOrReturn = callOrReturn(getExtensionField(extension, "allowGapCursor", context))) !== null && _callOrReturn !== void 0 ? _callOrReturn : null };
	}
});
/** The default data attribute label */
var DEFAULT_DATA_ATTRIBUTE = "placeholder";
/** The plugin key used to store and read the placeholder decoration set */
var PLUGIN_KEY = new PluginKey("tiptap__placeholder");
/**
* Creates a ProseMirror node decoration that applies a placeholder
* CSS class and data attribute to an empty node.
* @param options.editor - The editor instance
* @param options.pos - The position of the node in the document
* @param options.node - The ProseMirror node
* @param options.isEmptyDoc - Whether the entire document is empty
* @param options.hasAnchor - Whether the selection anchor is within the node
* @param options.dataAttribute - The data attribute name (e.g. `data-placeholder`)
* @param options.classes - CSS classes for empty nodes and the empty editor
* @param options.placeholder - The placeholder text or a function that returns it
* @returns A ProseMirror node decoration with placeholder classes and data attribute
*/
function createPlaceholderDecoration(options) {
	const { editor, placeholder, dataAttribute, pos, node, isEmptyDoc, hasAnchor, classes: { emptyNode, emptyEditor } } = options;
	const classes = [emptyNode];
	if (isEmptyDoc) classes.push(emptyEditor);
	return Decoration.node(pos, pos + node.nodeSize, {
		class: classes.join(" "),
		[dataAttribute]: typeof placeholder === "function" ? placeholder({
			editor,
			node,
			pos,
			hasAnchor
		}) : placeholder
	});
}
function resolveEmptyNodeClass(emptyNodeClass, props) {
	return typeof emptyNodeClass === "function" ? emptyNodeClass(props) : emptyNodeClass;
}
/**
* Scans a document range for empty textblocks that should receive placeholder
* decorations. Used by the slow path and incremental state updates.
*/
function scanRangeForDecorations({ editor, options, dataAttribute, doc, selection, from, to }) {
	const { anchor } = selection;
	const decorations = [];
	const isEmptyDoc = editor.isEmpty;
	doc.nodesBetween(from, to, (node, pos) => {
		const hasAnchor = anchor >= pos && anchor <= pos + node.nodeSize;
		const isEmpty = !node.isLeaf && isNodeEmpty(node);
		if (!node.type.isTextblock) return options.includeChildren;
		if ((hasAnchor || !options.showOnlyCurrent) && isEmpty) decorations.push(createPlaceholderDecoration({
			editor,
			isEmptyDoc,
			dataAttribute,
			hasAnchor,
			placeholder: options.placeholder,
			classes: {
				emptyEditor: options.emptyEditorClass,
				emptyNode: resolveEmptyNodeClass(options.emptyNodeClass, {
					editor,
					node,
					pos,
					hasAnchor
				})
			},
			node,
			pos
		}));
		return options.includeChildren;
	});
	return decorations;
}
/**
* Builds the placeholder decorations for the current document state.
* @param options.editor - The editor instance.
* @param options.options - The resolved placeholder options.
* @param options.dataAttribute - The prepared `data-*` attribute name.
* @param options.doc - The current document node.
* @param options.selection - The current selection.
* @returns A decoration set, or `null` when no placeholders should be shown.
*/
function buildPlaceholderDecorations({ editor, options, dataAttribute, doc, selection }) {
	if (!(editor.isEditable || !options.showOnlyWhenEditable)) return null;
	const { anchor } = selection;
	const decorations = [];
	const isEmptyDoc = editor.isEmpty;
	if (options.showOnlyCurrent && !options.includeChildren) {
		const resolved = doc.resolve(anchor);
		const node = resolved.depth > 0 ? resolved.node(1) : resolved.nodeAfter;
		const nodeStart = resolved.depth > 0 ? resolved.before(1) : anchor;
		if (node && node.type.isTextblock && isNodeEmpty(node)) {
			const hasAnchor = anchor >= nodeStart && anchor <= nodeStart + node.nodeSize;
			decorations.push(createPlaceholderDecoration({
				editor,
				isEmptyDoc,
				dataAttribute,
				hasAnchor,
				placeholder: options.placeholder,
				classes: {
					emptyEditor: options.emptyEditorClass,
					emptyNode: resolveEmptyNodeClass(options.emptyNodeClass, {
						editor,
						node,
						pos: nodeStart,
						hasAnchor
					})
				},
				node,
				pos: nodeStart
			}));
		}
	} else decorations.push(...scanRangeForDecorations({
		editor,
		options,
		dataAttribute,
		doc,
		selection,
		from: 0,
		to: doc.content.size
	}));
	return DecorationSet.create(doc, decorations);
}
/**
* Resolves a document position to the `[from, to)` range of its containing
* top-level block node in absolute document positions.
*/
function resolveTopLevelRange(doc, pos) {
	const resolved = doc.resolve(pos);
	if (resolved.depth === 0) {
		var _resolved$nodeAfter;
		const node = (_resolved$nodeAfter = resolved.nodeAfter) !== null && _resolved$nodeAfter !== void 0 ? _resolved$nodeAfter : resolved.nodeBefore;
		if (!node) return {
			from: pos,
			to: pos
		};
		const nodePos = resolved.nodeAfter ? pos : pos - node.nodeSize;
		return {
			from: nodePos,
			to: nodePos + node.nodeSize
		};
	}
	const topLevelPos = resolved.before(1);
	return {
		from: topLevelPos,
		to: topLevelPos + resolved.node(1).nodeSize
	};
}
/**
* Converts an absolute document range to content-relative positions used by
* `Node#nodesBetween` and `Node#forEach` offsets.
*/
function toContentRelativeRange(doc, range) {
	return {
		from: Math.max(0, range.from - 1),
		to: Math.min(doc.content.size, range.to - 1)
	};
}
/**
* Returns the top-level block ranges that intersect a document change range.
* Input `from`/`to` are absolute positions (e.g. from `getChangedRanges`).
* Returned ranges are content-relative, matching `Node#forEach` offsets.
*/
function getTopLevelBlocksInRange(doc, from, to) {
	const ranges = [];
	doc.forEach((node, offset) => {
		const nodeStart = offset;
		const nodeEnd = nodeStart + node.nodeSize;
		const absNodeStart = nodeStart + 1;
		const absNodeEnd = nodeEnd + 1;
		if (absNodeStart < to && absNodeEnd > from) ranges.push({
			from: nodeStart,
			to: nodeEnd
		});
	});
	return ranges;
}
/**
* Sorts ranges by start position and merges overlapping or adjacent ranges.
*/
function mergeRanges(ranges) {
	if (ranges.length === 0) return [];
	const sorted = [...ranges].sort((a, b) => a.from - b.from);
	const merged = [{ ...sorted[0] }];
	for (let i = 1; i < sorted.length; i += 1) {
		const last = merged[merged.length - 1];
		const current = sorted[i];
		if (current.from <= last.to) last.to = Math.max(last.to, current.to);
		else merged.push({ ...current });
	}
	return merged;
}
/**
* Expands a single changed range to the top-level blocks it touches.
* Also resolves blocks at range boundaries so split/merge edits update
* adjacent empty nodes (e.g. a new paragraph after Enter).
*/
function collectBlocksForChange(doc, change) {
	const ranges = getTopLevelBlocksInRange(doc, change.from, change.to);
	ranges.push(toContentRelativeRange(doc, resolveTopLevelRange(doc, change.from)));
	if (change.to > change.from) ranges.push(toContentRelativeRange(doc, resolveTopLevelRange(doc, Math.min(change.to, doc.content.size + 1) - 1)));
	else if (change.from < doc.content.size + 1) ranges.push(toContentRelativeRange(doc, resolveTopLevelRange(doc, Math.min(change.from + 1, doc.content.size))));
	return ranges;
}
/**
* Collects content-relative top-level block ranges that need placeholder
* decorations recomputed after a transaction.
*/
function collectRescanRanges(tr, oldState, newState) {
	const ranges = [];
	if (tr.docChanged) {
		const changes = getChangedRanges(tr);
		for (const change of changes) ranges.push(...collectBlocksForChange(newState.doc, change.newRange));
	}
	if (tr.selectionSet) {
		ranges.push(toContentRelativeRange(newState.doc, resolveTopLevelRange(newState.doc, tr.mapping.map(oldState.selection.anchor))));
		ranges.push(toContentRelativeRange(newState.doc, resolveTopLevelRange(newState.doc, newState.selection.anchor)));
	}
	return mergeRanges(ranges);
}
/** Clamps a content-relative range to `[0, doc.content.size]`. */
function clampRange(from, to, doc) {
	const clampedFrom = Math.max(0, Math.min(from, doc.content.size));
	return {
		from: clampedFrom,
		to: Math.max(clampedFrom, Math.min(to, doc.content.size))
	};
}
/**
* Removes and rebuilds placeholder decorations within the given ranges.
* Only drops decorations fully contained in a range so mapped decorations
* on neighbouring blocks (e.g. at a block boundary) are kept intact.
*/
function updateDecorationsInRanges({ decorations, ranges, editor, options, dataAttribute, doc, selection }) {
	let next = decorations;
	for (const range of ranges) {
		const { from, to } = clampRange(range.from, range.to, doc);
		const existing = next.find(from, to).filter((decoration) => decoration.from >= from && decoration.to <= to);
		if (existing.length) next = next.remove(existing);
		const newDecos = scanRangeForDecorations({
			editor,
			options,
			dataAttribute,
			doc,
			selection,
			from,
			to
		});
		if (newDecos.length) next = next.add(doc, newDecos);
	}
	return next;
}
/**
* Creates the incremental `StateField<DecorationSet>` used by the slow path
* (`showOnlyCurrent: false` or `includeChildren: true`).
*
* Decorations are mapped through each transaction and only recomputed for
* top-level blocks touched by document or selection changes.
* @param options.editor - The editor instance.
* @param options.options - The resolved placeholder options.
* @param options.dataAttribute - The prepared `data-*` attribute name.
* @returns A ProseMirror state field storing the placeholder decoration set.
*/
function createPlaceholderStateField({ editor, options, dataAttribute }) {
	return {
		init(_config, state) {
			const decorations = buildPlaceholderDecorations({
				editor,
				options,
				dataAttribute,
				doc: state.doc,
				selection: state.selection
			});
			return decorations !== null && decorations !== void 0 ? decorations : DecorationSet.empty;
		},
		apply(tr, prev, oldState, newState) {
			if (!tr.docChanged && !tr.selectionSet) return prev;
			return updateDecorationsInRanges({
				decorations: prev.map(tr.mapping, tr.doc),
				ranges: collectRescanRanges(tr, oldState, newState),
				editor,
				options,
				dataAttribute,
				doc: newState.doc,
				selection: newState.selection
			});
		}
	};
}
/**
* Prepares the placeholder attribute by ensuring it is properly formatted.
* @param attr - The placeholder attribute string.
* @returns The prepared placeholder attribute string.
*/
function preparePlaceholderAttribute(attr) {
	return attr.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").replace(/^[0-9-]+/, "").replace(/^-+/, "").toLowerCase();
}
/**
* Creates the ProseMirror plugin that renders placeholder decorations.
* @param options.editor - The editor instance.
* @param options.options - The resolved placeholder options.
* @returns The configured placeholder plugin.
*/
function createPlaceholderPlugin({ editor, options }) {
	const dataAttribute = options.dataAttribute ? `data-${preparePlaceholderAttribute(options.dataAttribute)}` : `data-${DEFAULT_DATA_ATTRIBUTE}`;
	const useResolvedPath = options.showOnlyCurrent && !options.includeChildren;
	return new Plugin({
		key: PLUGIN_KEY,
		...useResolvedPath ? {} : { state: createPlaceholderStateField({
			editor,
			options,
			dataAttribute
		}) },
		props: { decorations: useResolvedPath ? ({ doc, selection }) => buildPlaceholderDecorations({
			editor,
			options,
			dataAttribute,
			doc,
			selection
		}) : (state) => {
			var _PLUGIN_KEY$getState;
			if (options.showOnlyWhenEditable && !editor.isEditable) return DecorationSet.empty;
			return (_PLUGIN_KEY$getState = PLUGIN_KEY.getState(state)) !== null && _PLUGIN_KEY$getState !== void 0 ? _PLUGIN_KEY$getState : DecorationSet.empty;
		} }
	});
}
Extension.create({
	name: "placeholder",
	addOptions() {
		return {
			emptyEditorClass: "is-editor-empty",
			emptyNodeClass: "is-empty",
			dataAttribute: DEFAULT_DATA_ATTRIBUTE,
			placeholder: "Write something …",
			showOnlyWhenEditable: true,
			showOnlyCurrent: true,
			includeChildren: false
		};
	},
	addProseMirrorPlugins() {
		return [createPlaceholderPlugin({
			editor: this.editor,
			options: this.options
		})];
	}
});
/**
* Whether the native browser selection should be cleared on blur and restored on focus.
* Only applies to non-empty text selections in an editable editor.
*/
function shouldSyncDomSelection(state, editor) {
	return !state.selection.empty && !isNodeSelection(state.selection) && editor.isEditable;
}
/**
* Whether the selection decoration should be rendered to keep the selection
* visible while the editor is blurred (and not dragging).
*/
function shouldPreserveSelection(state, editor) {
	return shouldSyncDomSelection(state, editor) && !editor.isFocused && !editor.view.dragging;
}
function clearDomSelection() {
	var _window$getSelection;
	(_window$getSelection = window.getSelection()) === null || _window$getSelection === void 0 || _window$getSelection.removeAllRanges();
}
/**
* Sync the native selection from the editor state.
* @see https://prosemirror.net/docs/ref/#view.EditorView.focus
*/
function restoreDomSelection(view) {
	view.focus();
}
Extension.create({
	name: "selection",
	addOptions() {
		return { className: "selection" };
	},
	addProseMirrorPlugins() {
		const { editor, options } = this;
		return [new Plugin({
			key: new PluginKey("selection"),
			props: {
				decorations(state) {
					if (!shouldPreserveSelection(state, editor)) return null;
					return DecorationSet.create(state.doc, [Decoration.inline(state.selection.from, state.selection.to, { class: options.className })]);
				},
				handleDOMEvents: {
					blur(view) {
						if (!shouldSyncDomSelection(view.state, editor)) return false;
						clearDomSelection();
						return false;
					},
					focus(view) {
						if (!shouldSyncDomSelection(view.state, editor)) return false;
						requestAnimationFrame(() => {
							if (!editor.isDestroyed && view.hasFocus()) restoreDomSelection(view);
						});
						return false;
					}
				}
			}
		})];
	}
});
function nodeEqualsType({ types, node }) {
	return node && Array.isArray(types) && types.includes(node.type) || (node === null || node === void 0 ? void 0 : node.type) === types;
}
/**
* This extension allows you to add an extra node at the end of the document.
* @see https://www.tiptap.dev/api/extensions/trailing-node
*/
var TrailingNode = Extension.create({
	name: "trailingNode",
	addOptions() {
		return {
			node: void 0,
			notAfter: []
		};
	},
	addProseMirrorPlugins() {
		var _this$editor$schema$t;
		const plugin = new PluginKey(this.name);
		const defaultNode = this.options.node || ((_this$editor$schema$t = this.editor.schema.topNodeType.contentMatch.defaultType) === null || _this$editor$schema$t === void 0 ? void 0 : _this$editor$schema$t.name) || "paragraph";
		const disabledNodes = Object.entries(this.editor.schema.nodes).map(([, value]) => value).filter((node) => (this.options.notAfter || []).concat(defaultNode).includes(node.name));
		return [new Plugin({
			key: plugin,
			appendTransaction: (transactions, __, state) => {
				const { doc, tr, schema } = state;
				const shouldInsertNodeAtEnd = plugin.getState(state);
				const endPosition = doc.content.size;
				const type = schema.nodes[defaultNode];
				if (transactions.some((transaction) => transaction.getMeta("skipTrailingNode"))) return;
				if (!shouldInsertNodeAtEnd) return;
				return tr.insert(endPosition, type.create());
			},
			state: {
				init: (_, state) => {
					const lastNode = state.tr.doc.lastChild;
					return !nodeEqualsType({
						node: lastNode,
						types: disabledNodes
					});
				},
				apply: (tr, value) => {
					if (!tr.docChanged) return value;
					if (tr.getMeta("__uniqueIDTransaction")) return value;
					const lastNode = tr.doc.lastChild;
					return !nodeEqualsType({
						node: lastNode,
						types: disabledNodes
					});
				}
			}
		})];
	}
});
/**
* This extension allows you to undo and redo recent changes.
* @see https://www.tiptap.dev/api/extensions/undo-redo
*
* **Important**: If the `@tiptap/extension-collaboration` package is used, make sure to remove
* the `undo-redo` extension, as it is not compatible with the `collaboration` extension.
*
* `@tiptap/extension-collaboration` uses its own history implementation.
*/
var UndoRedo = Extension.create({
	name: "undoRedo",
	addOptions() {
		return {
			depth: 100,
			newGroupDelay: 500
		};
	},
	addCommands() {
		return {
			undo: () => ({ state, dispatch }) => {
				return undo(state, dispatch);
			},
			redo: () => ({ state, dispatch }) => {
				return redo(state, dispatch);
			}
		};
	},
	addProseMirrorPlugins() {
		return [history(this.options)];
	},
	addKeyboardShortcuts() {
		return {
			"Mod-z": () => this.editor.commands.undo(),
			"Shift-Mod-z": () => this.editor.commands.redo(),
			"Mod-y": () => this.editor.commands.redo(),
			"Mod-я": () => this.editor.commands.undo(),
			"Shift-Mod-я": () => this.editor.commands.redo()
		};
	}
});
//#endregion
//#region ../../node_modules/@tiptap/starter-kit/dist/index.js
/**
* The starter kit is a collection of essential editor extensions.
*
* It’s a good starting point for building your own editor.
*/
var StarterKit = Extension.create({
	name: "starterKit",
	addExtensions() {
		const extensions = [];
		if (this.options.bold !== false) extensions.push(Bold.configure(this.options.bold));
		if (this.options.blockquote !== false) extensions.push(Blockquote.configure(this.options.blockquote));
		if (this.options.bulletList !== false) extensions.push(BulletList.configure(this.options.bulletList));
		if (this.options.code !== false) extensions.push(Code.configure(this.options.code));
		if (this.options.codeBlock !== false) extensions.push(CodeBlock.configure(this.options.codeBlock));
		if (this.options.document !== false) extensions.push(Document.configure(this.options.document));
		if (this.options.dropcursor !== false) extensions.push(Dropcursor.configure(this.options.dropcursor));
		if (this.options.gapcursor !== false) extensions.push(Gapcursor.configure(this.options.gapcursor));
		if (this.options.hardBreak !== false) extensions.push(HardBreak.configure(this.options.hardBreak));
		if (this.options.heading !== false) extensions.push(Heading.configure(this.options.heading));
		if (this.options.undoRedo !== false) extensions.push(UndoRedo.configure(this.options.undoRedo));
		if (this.options.horizontalRule !== false) extensions.push(HorizontalRule.configure(this.options.horizontalRule));
		if (this.options.italic !== false) extensions.push(Italic.configure(this.options.italic));
		if (this.options.listItem !== false) extensions.push(ListItem.configure(this.options.listItem));
		if (this.options.listKeymap !== false) {
			var _this$options;
			extensions.push(ListKeymap.configure((_this$options = this.options) === null || _this$options === void 0 ? void 0 : _this$options.listKeymap));
		}
		if (this.options.link !== false) {
			var _this$options2;
			extensions.push(Link.configure((_this$options2 = this.options) === null || _this$options2 === void 0 ? void 0 : _this$options2.link));
		}
		if (this.options.orderedList !== false) extensions.push(OrderedList.configure(this.options.orderedList));
		if (this.options.paragraph !== false) extensions.push(Paragraph.configure(this.options.paragraph));
		if (this.options.strike !== false) extensions.push(Strike.configure(this.options.strike));
		if (this.options.text !== false) extensions.push(Text.configure(this.options.text));
		if (this.options.underline !== false) {
			var _this$options3;
			extensions.push(Underline.configure((_this$options3 = this.options) === null || _this$options3 === void 0 ? void 0 : _this$options3.underline));
		}
		if (this.options.trailingNode !== false) {
			var _this$options4;
			extensions.push(TrailingNode.configure((_this$options4 = this.options) === null || _this$options4 === void 0 ? void 0 : _this$options4.trailingNode));
		}
		return extensions;
	}
});
var src_default = StarterKit;
//#endregion
export { StarterKit, src_default as default };

//# sourceMappingURL=dist-CUXPL_RM.js.map
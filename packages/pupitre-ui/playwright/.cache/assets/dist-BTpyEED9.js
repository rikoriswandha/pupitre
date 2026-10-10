import { i as require_react, r as require_react_dom, s as __toESM } from "./index-Cy4IS1Mx.js";
import { $ as generateText, $t as isProseMirrorRemoveMarkStep, A as createChainableState, An as resolveFocusPosition, At as isAndroid, B as elementFromString, Bn as wrappingInputRule, Bt as isNodeActive, C as attrsEqual, Cn as parseAttributes, Ct as getTextContentFromNodes, D as commands_exports, Dn as removeDuplicates, Dt as injectExtensionAttributesToParseRule, E as combineTransactionSteps, En as posToDOMRect, Et as h, F as createStyleTag, Fn as splitExtensions, Ft as isFirefox, G as findChildrenInRange, Gt as isPlainObject, H as escapeForRegEx, Ht as isNodeSelection, I as createWidgetDecoration, In as textInputRule, It as isFunction, J as findParentNodeClosestToPos, Jt as isProseMirrorAttrStep, K as findDuplicates, Kt as isProseMirrorAddMarkStep, L as decodeHtmlEntities, Ln as textPasteRule, Lt as isList, M as createInlineMarkdownSpec, Mn as selectionToInsertionEnd, Mt as isAtStartOfNode, N as createMappablePosition, Nn as serializeAttributes, Nt as isEmptyObject, O as createAtomBlockMarkdownSpec, On as renderNestedMarkdownContent, Ot as inputRulesPlugin, P as createNodeFromContent, Pn as sortExtensions, Pt as isExtensionRulesEnabled, Q as generateJSON, Qt as isProseMirrorNodeSelection, R as defaultBlockAt, Rn as textblockTypeInputRule, Rt as isMacOS, S as WidgetDecoration, Sn as objectIncludes, St as getTextBetween, T as canInsertNode, Tn as pasteRulesPlugin, Tt as getUpdatedPosition, U as extensions_exports, Ut as isNodeViewSelected, V as encodeHtmlEntities, Vt as isNodeEmpty, W as findChildren, Wt as isNumber, X as fromString, Xn as PluginKey, Xt as isProseMirrorDocAttrStep, Y as flattenExtensions, Yn as Plugin, Yt as isProseMirrorCellSelection, Z as generateHTML, Zt as isProseMirrorFragment, _ as NodeView, _n as mergeAttributes, _t as getSchemaTypeByName, a as Editor, an as isProseMirrorStepResult, at as getHTMLFromFragment, b as ResizableNodeview, bn as nodeInputRule, bt as getStyleProperty, c as Fragment, cn as isString, ct as getMarkType, d as MappablePosition, dn as isiOS, dt as getNodeAttributes, en as isProseMirrorRemoveNodeMarkStep, et as getAttributes, f as Mark, fn as liveWidgetKeys, ft as getNodeType, g as NodePos, gn as marksEqual, gt as getSchemaByResolvedExtensions, h as NodeDecoration, hn as markdown_exports, ht as getSchema, i as DecorationManager, in as isProseMirrorStep, it as getExtensionField, j as createDocument, jn as rewriteUnknownContent, jt as isAtEndOfNode, k as createBlockMarkdownSpec, kn as resolveExtensions, kt as isActive, l as InlineDecoration, ln as isTextSelection, lt as getMarksBetween, m as Node, mn as markPasteRule, mt as getRenderedAttributes, n as DECORATION_MANAGER_PLUGIN_KEY, nn as isProseMirrorReplaceStep, nt as getChangedRanges, o as Extendable, on as isRegExp, ot as getMarkAttributes, p as MarkView, pn as markInputRule, pt as getPreviousBlockSibling, q as findParentNode, qt as isProseMirrorAddNodeMarkStep, r as Decoration, rn as isProseMirrorSlice, rt as getDebugJSON, s as Extension, sn as isSafari, st as getMarkRange, t as CommandManager, tn as isProseMirrorReplaceAroundStep, tt as getAttributesFromExtensions, u as InputRule, un as isValidCSSStyleValue, ut as getNodeAtPosition, v as PasteRule, vn as mergeDeep, vt as getSchemaTypeNameByName, w as callOrReturn, wn as parseIndentedBlocks, wt as getTextSerializersFromSchema, x as Tracker, xn as nodePasteRule, xt as getText, y as ResizableNodeView, yn as minMax, yt as getSplittedAttributes, z as deleteProps, zn as updateMarkViewAttributes, zt as isMarkActive } from "./dist-D5N53XOC.js";
import { n as require_jsx_runtime, r as require_shim, t as require_with_selector } from "./catalog.story-Dc6N-k58.js";
//#region ../../node_modules/fast-equals/dist/es/index.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_react_dom = /* @__PURE__ */ __toESM(require_react_dom(), 1);
var import_shim = require_shim();
var import_jsx_runtime = require_jsx_runtime();
var { getOwnPropertyNames, getOwnPropertySymbols } = Object;
var { hasOwnProperty } = Object.prototype;
/**
* Combine two comparators into a single comparators.
*/
function combineComparators(comparatorA, comparatorB) {
	return function isEqual(a, b, state) {
		return comparatorA(a, b, state) && comparatorB(a, b, state);
	};
}
/**
* Wrap the provided `areItemsEqual` method to manage the circular state, allowing
* for circular references to be safely included in the comparison without creating
* stack overflows.
*/
function createIsCircular(areItemsEqual) {
	return function isCircular(a, b, state) {
		if (!a || !b || typeof a !== "object" || typeof b !== "object") return areItemsEqual(a, b, state);
		const { cache } = state;
		const cachedA = cache.get(a);
		const cachedB = cache.get(b);
		if (cachedA && cachedB) return cachedA === b && cachedB === a;
		cache.set(a, b);
		cache.set(b, a);
		const result = areItemsEqual(a, b, state);
		cache.delete(a);
		cache.delete(b);
		return result;
	};
}
/**
* Get the `@@toStringTag` of the value, if it exists.
*/
function getShortTag(value) {
	return value != null ? value[Symbol.toStringTag] : void 0;
}
/**
* Get the properties to strictly examine, which include both own properties that are
* not enumerable and symbol properties.
*/
function getStrictProperties(object) {
	return getOwnPropertyNames(object).concat(getOwnPropertySymbols(object));
}
/**
* Whether the object contains the property passed as an own property.
*/
var hasOwn = Object.hasOwn || ((object, property) => hasOwnProperty.call(object, property));
/**
* Whether the values passed are strictly equal or both NaN.
*/
function sameValueZeroEqual(a, b) {
	return a === b || !a && !b && a !== a && b !== b;
}
var PREACT_VNODE = "__v";
var PREACT_OWNER = "__o";
var REACT_OWNER = "_owner";
var { getOwnPropertyDescriptor, keys } = Object;
/**
* Identify the element type of TypedArrays across realms and subclasses.
*/
var getTypedArrayTag = getOwnPropertyDescriptor(Object.getPrototypeOf(Int8Array.prototype), Symbol.toStringTag).get;
/**
* Whether the array buffers are equal in value.
*/
function areArrayBuffersEqual(a, b) {
	return a.byteLength === b.byteLength && areTypedArraysEqual(new Uint8Array(a), new Uint8Array(b));
}
/**
* Whether the arrays are equal in value.
*/
function areArraysEqual(a, b, state) {
	let index = a.length;
	if (b.length !== index) return false;
	while (index-- > 0) if (!state.equals(a[index], b[index], index, index, a, b, state)) return false;
	return true;
}
/**
* Whether the dataviews are equal in value.
*/
function areDataViewsEqual(a, b) {
	return a.byteLength === b.byteLength && areTypedArraysEqual(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), new Uint8Array(b.buffer, b.byteOffset, b.byteLength));
}
/**
* Whether the dates passed are equal in value.
*/
function areDatesEqual(a, b) {
	return sameValueZeroEqual(a.getTime(), b.getTime());
}
/**
* Whether the errors passed are equal in value.
*/
function areErrorsEqual(a, b, state) {
	return a.name === b.name && a.message === b.message && a.stack === b.stack && state.equals(a.cause, b.cause, "cause", "cause", a, b, state);
}
/**
* Whether the functions passed are equal in value.
*/
function areFunctionsEqual(a, b) {
	return a === b;
}
/**
* Whether the `Map`s are equal in value.
*/
function areMapsEqual(a, b, state) {
	const size = a.size;
	if (size !== b.size) return false;
	if (!size) return true;
	const matchedIndices = new Array(size);
	const aIterable = a.entries();
	let aResult;
	let bResult;
	let index = 0;
	while (aResult = aIterable.next()) {
		if (aResult.done) break;
		const bIterable = b.entries();
		let hasMatch = false;
		let matchIndex = 0;
		while (bResult = bIterable.next()) {
			if (bResult.done) break;
			if (matchedIndices[matchIndex]) {
				matchIndex++;
				continue;
			}
			const aEntry = aResult.value;
			const bEntry = bResult.value;
			if (state.equals(aEntry[0], bEntry[0], index, matchIndex, a, b, state) && state.equals(aEntry[1], bEntry[1], aEntry[0], bEntry[0], a, b, state)) {
				hasMatch = matchedIndices[matchIndex] = true;
				break;
			}
			matchIndex++;
		}
		if (!hasMatch) return false;
		index++;
	}
	return true;
}
/**
* Whether the numbers are equal in value.
*/
var areNumbersEqual = sameValueZeroEqual;
/**
* Whether the objects are equal in value.
*/
function areObjectsEqual(a, b, state) {
	const properties = keys(a);
	let index = properties.length;
	if (keys(b).length !== index) return false;
	while (index-- > 0) if (!isPropertyEqual(a, b, state, properties[index])) return false;
	return true;
}
/**
* Whether the objects are equal in value with strict property checking.
*/
function areObjectsEqualStrict(a, b, state) {
	const properties = getStrictProperties(a);
	let index = properties.length;
	if (getStrictProperties(b).length !== index) return false;
	let property;
	let descriptorA;
	let descriptorB;
	while (index-- > 0) {
		property = properties[index];
		if (!isPropertyEqual(a, b, state, property)) return false;
		descriptorA = getOwnPropertyDescriptor(a, property);
		descriptorB = getOwnPropertyDescriptor(b, property);
		if ((descriptorA || descriptorB) && (!descriptorA || !descriptorB || descriptorA.configurable !== descriptorB.configurable || descriptorA.enumerable !== descriptorB.enumerable || descriptorA.writable !== descriptorB.writable)) return false;
	}
	return true;
}
/**
* Whether the primitive wrappers passed are equal in value.
*/
function arePrimitiveWrappersEqual(a, b) {
	return sameValueZeroEqual(a.valueOf(), b.valueOf());
}
/**
* Whether the regexps passed are equal in value.
*/
function areRegExpsEqual(a, b) {
	return a.source === b.source && a.flags === b.flags;
}
/**
* Whether the `Set`s are equal in value.
*/
function areSetsEqual(a, b, state) {
	const size = a.size;
	if (size !== b.size) return false;
	if (!size) return true;
	const matchedIndices = new Array(size);
	const aIterable = a.values();
	let aResult;
	let bResult;
	while (aResult = aIterable.next()) {
		if (aResult.done) break;
		const bIterable = b.values();
		let hasMatch = false;
		let matchIndex = 0;
		while (bResult = bIterable.next()) {
			if (bResult.done) break;
			if (!matchedIndices[matchIndex] && state.equals(aResult.value, bResult.value, aResult.value, bResult.value, a, b, state)) {
				hasMatch = matchedIndices[matchIndex] = true;
				break;
			}
			matchIndex++;
		}
		if (!hasMatch) return false;
	}
	return true;
}
/**
* Whether the TypedArray instances are equal in value.
*/
function areTypedArraysEqual(a, b) {
	let index = a.length;
	if (b.length !== index || a.byteOffset !== b.byteOffset) return false;
	const tag = getTypedArrayTag.call(a);
	if (tag === "Float64Array" || tag === "Float32Array" || tag === "Float16Array") {
		while (index-- > 0) if (a[index] !== b[index] && (a[index] === a[index] || b[index] === b[index])) return false;
		return true;
	}
	while (index-- > 0) if (a[index] !== b[index]) return false;
	return true;
}
/**
* Whether the URL instances are equal in value.
*/
function areUrlsEqual(a, b) {
	if (a.href === b.href) return true;
	return a.protocol === b.protocol && a.username === b.username && a.password === b.password && a.host === b.host && a.pathname === b.pathname && a.hash === b.hash && areSearchParamsEqual(a.searchParams, b.searchParams);
}
/**
* Whether the search params passed are equal in value.
*
* @note
* Order is not significant, matching how the other unordered collections in the library are
* compared. Repeated keys are, so this is a comparison of multisets rather than of sets:
* `a=1&a=2` is equal to `a=2&a=1`, but not to `a=1&a=1`.
*/
function areSearchParamsEqual(a, b) {
	const serializedA = a.toString();
	const serializedB = b.toString();
	return serializedA === serializedB || sortSearchParams(serializedA) === sortSearchParams(serializedB);
}
/**
* Reorder a serialized query string so that params holding the same pairs compare as equal
* regardless of the order they appear in.
*
* @note
* The serializer percent-encodes `&` and `=` wherever they appear inside a name or a value, so
* splitting on `&` recovers exactly the pairs and nothing else.
*/
function sortSearchParams(serialized) {
	return serialized.split("&").sort().join("&");
}
function isPropertyEqual(a, b, state, property) {
	if ((property === REACT_OWNER || property === PREACT_OWNER || property === PREACT_VNODE) && (a.$$typeof || b.$$typeof)) return true;
	return hasOwn(b, property) && state.equals(a[property], b[property], property, property, a, b, state);
}
var ARRAY_BUFFER_TAG = "[object ArrayBuffer]";
var ARGUMENTS_TAG = "[object Arguments]";
var BOOLEAN_TAG = "[object Boolean]";
var DATA_VIEW_TAG = "[object DataView]";
var DATE_TAG = "[object Date]";
var ERROR_TAG = "[object Error]";
var MAP_TAG = "[object Map]";
var NUMBER_TAG = "[object Number]";
var OBJECT_TAG = "[object Object]";
var REG_EXP_TAG = "[object RegExp]";
var SET_TAG = "[object Set]";
var STRING_TAG = "[object String]";
var TYPED_ARRAY_TAGS = {
	"[object Int8Array]": true,
	"[object Uint8Array]": true,
	"[object Uint8ClampedArray]": true,
	"[object Int16Array]": true,
	"[object Uint16Array]": true,
	"[object Int32Array]": true,
	"[object Uint32Array]": true,
	"[object Float16Array]": true,
	"[object Float32Array]": true,
	"[object Float64Array]": true,
	"[object BigInt64Array]": true,
	"[object BigUint64Array]": true
};
var URL_TAG = "[object URL]";
var toString = Object.prototype.toString;
/**
* Create a comparator method based on the type-specific equality comparators passed.
*/
function createEqualityComparator({ areArrayBuffersEqual, areArraysEqual, areDataViewsEqual, areDatesEqual, areErrorsEqual, areFunctionsEqual, areMapsEqual, areNumbersEqual, areObjectsEqual, arePrimitiveWrappersEqual, areRegExpsEqual, areSetsEqual, areTypedArraysEqual, areUrlsEqual, unknownTagComparators }) {
	/**
	* compare the value of the two objects and return true if they are equivalent in values
	*/
	return function comparator(a, b, state) {
		if (a === b) return true;
		if (a == null || b == null) return false;
		const type = typeof a;
		if (type !== typeof b) return false;
		if (type !== "object") {
			if (type === "number") return areNumbersEqual(a, b, state);
			if (type === "function") return areFunctionsEqual(a, b, state);
			return false;
		}
		const constructor = a.constructor;
		if (constructor !== b.constructor) return false;
		if (constructor === Object) return areObjectsEqual(a, b, state);
		if (Array.isArray(a)) return areArraysEqual(a, b, state);
		if (constructor === Date) return areDatesEqual(a, b, state);
		if (constructor === RegExp) return areRegExpsEqual(a, b, state);
		if (constructor === Map) return areMapsEqual(a, b, state);
		if (constructor === Set) return areSetsEqual(a, b, state);
		if (constructor == null) return areObjectsEqual(a, b, state);
		const tag = toString.call(a);
		if (tag === DATE_TAG) return areDatesEqual(a, b, state);
		if (tag === REG_EXP_TAG) return areRegExpsEqual(a, b, state);
		if (tag === MAP_TAG) return areMapsEqual(a, b, state);
		if (tag === SET_TAG) return areSetsEqual(a, b, state);
		if (tag === OBJECT_TAG) return typeof a.then !== "function" && typeof b.then !== "function" && areObjectsEqual(a, b, state);
		if (tag === URL_TAG) return areUrlsEqual(a, b, state);
		if (tag === ERROR_TAG) return areErrorsEqual(a, b, state);
		if (tag === ARGUMENTS_TAG) return areObjectsEqual(a, b, state);
		if (TYPED_ARRAY_TAGS[tag]) return areTypedArraysEqual(a, b, state);
		if (tag === ARRAY_BUFFER_TAG) return areArrayBuffersEqual(a, b, state);
		if (tag === DATA_VIEW_TAG) return areDataViewsEqual(a, b, state);
		if (tag === BOOLEAN_TAG || tag === NUMBER_TAG || tag === STRING_TAG) return arePrimitiveWrappersEqual(a, b, state);
		if (unknownTagComparators) {
			let unknownTagComparator = unknownTagComparators[tag];
			if (!unknownTagComparator) {
				const shortTag = getShortTag(a);
				if (shortTag) unknownTagComparator = unknownTagComparators[shortTag];
			}
			if (unknownTagComparator) return unknownTagComparator(a, b, state);
		}
		return false;
	};
}
/**
* Create the configuration object used for building comparators.
*/
function createEqualityComparatorConfig({ circular, createCustomConfig, strict }) {
	let config = {
		areArrayBuffersEqual,
		areArraysEqual: strict ? areObjectsEqualStrict : areArraysEqual,
		areDataViewsEqual,
		areDatesEqual,
		areErrorsEqual: strict ? combineComparators(areErrorsEqual, areObjectsEqualStrict) : combineComparators(areErrorsEqual, areObjectsEqual),
		areFunctionsEqual,
		areMapsEqual: strict ? combineComparators(areMapsEqual, areObjectsEqualStrict) : areMapsEqual,
		areNumbersEqual,
		areObjectsEqual: strict ? areObjectsEqualStrict : areObjectsEqual,
		arePrimitiveWrappersEqual,
		areRegExpsEqual,
		areSetsEqual: strict ? combineComparators(areSetsEqual, areObjectsEqualStrict) : areSetsEqual,
		areTypedArraysEqual: strict ? combineComparators(areTypedArraysEqual, areObjectsEqualStrict) : areTypedArraysEqual,
		areUrlsEqual,
		unknownTagComparators: void 0
	};
	if (createCustomConfig) config = Object.assign({}, config, createCustomConfig(config));
	if (circular) {
		const areArraysEqual = createIsCircular(config.areArraysEqual);
		const areErrorsEqual = createIsCircular(config.areErrorsEqual);
		const areMapsEqual = createIsCircular(config.areMapsEqual);
		const areObjectsEqual = createIsCircular(config.areObjectsEqual);
		const areSetsEqual = createIsCircular(config.areSetsEqual);
		config = Object.assign({}, config, {
			areArraysEqual,
			areErrorsEqual,
			areMapsEqual,
			areObjectsEqual,
			areSetsEqual
		});
	}
	return config;
}
/**
* Default equality comparator pass-through, used as the standard `isEqual` creator for
* use inside the built comparator.
*/
function createInternalEqualityComparator(compare) {
	return function(a, b, _indexOrKeyA, _indexOrKeyB, _parentA, _parentB, state) {
		return compare(a, b, state);
	};
}
/**
* Create the `isEqual` function used by the consuming application.
*/
function createIsEqual({ circular, comparator, createState, equals, strict }) {
	if (createState) return function isEqual(a, b) {
		const { cache = circular ? /* @__PURE__ */ new WeakMap() : void 0, meta } = createState();
		return comparator(a, b, {
			cache,
			equals,
			meta,
			strict
		});
	};
	if (circular) return function isEqual(a, b) {
		return comparator(a, b, {
			cache: /* @__PURE__ */ new WeakMap(),
			equals,
			meta: void 0,
			strict
		});
	};
	const state = {
		cache: void 0,
		equals,
		meta: void 0,
		strict
	};
	return function isEqual(a, b) {
		return comparator(a, b, state);
	};
}
/**
* Whether the items passed are deeply-equal in value.
*/
var deepEqual = createCustomEqual();
createCustomEqual({ strict: true });
createCustomEqual({ circular: true });
createCustomEqual({
	circular: true,
	strict: true
});
createCustomEqual({ createInternalComparator: () => sameValueZeroEqual });
createCustomEqual({
	strict: true,
	createInternalComparator: () => sameValueZeroEqual
});
createCustomEqual({
	circular: true,
	createInternalComparator: () => sameValueZeroEqual
});
createCustomEqual({
	circular: true,
	createInternalComparator: () => sameValueZeroEqual,
	strict: true
});
/**
* Create a custom equality comparison method.
*
* This can be done to create very targeted comparisons in extreme hot-path scenarios
* where the standard methods are not performant enough, but can also be used to provide
* support for legacy environments that do not support expected features like
* `RegExp.prototype.flags` out of the box.
*/
function createCustomEqual(options = {}) {
	const { circular = false, createInternalComparator: createCustomInternalComparator, createState, strict = false } = options;
	const comparator = createEqualityComparator(createEqualityComparatorConfig(options));
	return createIsEqual({
		circular,
		comparator,
		createState,
		equals: createCustomInternalComparator ? createCustomInternalComparator(comparator) : createInternalEqualityComparator(comparator),
		strict
	});
}
//#endregion
//#region ../../node_modules/@tiptap/react/dist/index.js
var import_with_selector = require_with_selector();
function handleMobileEnter(editor, event) {
	var _root$getSelection, _root$getSelection2;
	if (editor.isDestroyed || event.defaultPrevented || !event.cancelable || !editor.isEditable || event.inputType !== "insertParagraph" && event.inputType !== "insertLineBreak" || !isiOS() && !isAndroid()) return;
	const view = editor.view;
	const root = view.root;
	const selection = (_root$getSelection = (_root$getSelection2 = root.getSelection) === null || _root$getSelection2 === void 0 ? void 0 : _root$getSelection2.call(root)) !== null && _root$getSelection !== void 0 ? _root$getSelection : view.dom.ownerDocument.getSelection();
	const anchor = selection === null || selection === void 0 ? void 0 : selection.anchorNode;
	const element = (anchor === null || anchor === void 0 ? void 0 : anchor.nodeType) === 1 ? anchor : anchor === null || anchor === void 0 ? void 0 : anchor.parentElement;
	const contentDOM = element === null || element === void 0 ? void 0 : element.closest("[data-node-view-content-react]");
	if (!contentDOM || !view.dom.contains(contentDOM)) return;
	const lastKeyCode = view.input.lastKeyCode;
	if (lastKeyCode === 13) view.input.lastKeyCode = null;
	view.domObserver.forceFlush();
	view.domObserver.flush();
	const keyEvent = new KeyboardEvent("keydown", {
		key: "Enter",
		code: "Enter",
		keyCode: 13,
		shiftKey: event.inputType === "insertLineBreak",
		bubbles: true,
		cancelable: true
	});
	if (view.someProp("handleKeyDown", (handleKeyDown) => handleKeyDown(view, keyEvent))) {
		event.preventDefault();
		view.input.lastIOSEnter = 0;
		clearTimeout(view.input.lastIOSEnterFallbackTimeout);
	} else if (lastKeyCode === 13) view.input.lastKeyCode = lastKeyCode;
}
var mobileEnterPluginKey = new PluginKey("reactMobileEnter");
var mergeRefs = (...refs) => {
	return (node) => {
		refs.forEach((ref) => {
			if (typeof ref === "function") ref(node);
			else if (ref) ref.current = node;
		});
	};
};
/**
* This component renders all of the editor's node views.
*/
var Portals = ({ contentComponent }) => {
	const renderers = (0, import_shim.useSyncExternalStore)(contentComponent.subscribe, contentComponent.getSnapshot, contentComponent.getServerSnapshot);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: Object.values(renderers) });
};
function createContentComponent() {
	const subscribers = /* @__PURE__ */ new Set();
	let renderers = {};
	let isNotificationQueued = false;
	const notifySubscribers = () => {
		if (isNotificationQueued || !subscribers.size) return;
		isNotificationQueued = true;
		queueMicrotask(() => {
			isNotificationQueued = false;
			subscribers.forEach((subscriber) => subscriber());
		});
	};
	return {
		/**
		* Subscribe to the editor instance's changes.
		*/
		subscribe(callback) {
			subscribers.add(callback);
			return () => {
				subscribers.delete(callback);
			};
		},
		getSnapshot() {
			return renderers;
		},
		getServerSnapshot() {
			return renderers;
		},
		/**
		* Adds a new NodeView Renderer to the editor.
		*/
		setRenderer(id, renderer) {
			renderers = {
				...renderers,
				[id]: import_react_dom.createPortal(renderer.reactElement, renderer.element, id)
			};
			notifySubscribers();
		},
		/**
		* Removes a NodeView Renderer from the editor.
		*/
		removeRenderer(id) {
			const nextRenderers = { ...renderers };
			delete nextRenderers[id];
			renderers = nextRenderers;
			notifySubscribers();
		}
	};
}
var PureEditorContent = class extends import_react.Component {
	constructor(props) {
		super(props);
		this.editorContentRef = import_react.createRef();
	}
	componentDidMount() {
		this.init();
	}
	componentDidUpdate() {
		this.init();
	}
	init() {
		var _editor$view$dom;
		const editor = this.props.editor;
		if (editor && !editor.isDestroyed && ((_editor$view$dom = editor.view.dom) === null || _editor$view$dom === void 0 ? void 0 : _editor$view$dom.parentNode)) {
			if (editor.contentComponent) return;
			const element = this.editorContentRef.current;
			element.append(...editor.view.dom.parentNode.childNodes);
			editor.setOptions({ element });
			editor.contentComponent = createContentComponent();
			editor.createNodeViews();
			editor.registerPlugin(new Plugin({
				key: mobileEnterPluginKey,
				props: { handleDOMEvents: { beforeinput: (_view, event) => handleMobileEnter(editor, event) } }
			}));
			editor.isEditorContentInitialized = true;
			this.forceUpdate();
		}
	}
	componentWillUnmount() {
		const editor = this.props.editor;
		if (!editor) return;
		editor.isEditorContentInitialized = false;
		if (!editor.isDestroyed) {
			editor.unregisterPlugin(mobileEnterPluginKey);
			editor.view.setProps({ nodeViews: {} });
		}
		editor.contentComponent = null;
		try {
			var _editor$view$dom2;
			if (!((_editor$view$dom2 = editor.view.dom) === null || _editor$view$dom2 === void 0 ? void 0 : _editor$view$dom2.parentNode)) return;
			const newElement = document.createElement("div");
			newElement.append(...editor.view.dom.parentNode.childNodes);
			editor.setOptions({ element: newElement });
		} catch {}
	}
	render() {
		const { editor, innerRef, ...rest } = this.props;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: mergeRefs(innerRef, this.editorContentRef),
			...rest
		}), (editor === null || editor === void 0 ? void 0 : editor.contentComponent) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portals, { contentComponent: editor.contentComponent })] });
	}
};
var EditorContentWithKey = (0, import_react.forwardRef)((props, ref) => {
	const key = import_react.useMemo(() => {
		return Math.floor(Math.random() * 4294967295).toString();
	}, [props.editor]);
	return import_react.createElement(PureEditorContent, {
		key,
		innerRef: ref,
		...props
	});
});
var EditorContent = import_react.memo(EditorContentWithKey);
var useIsomorphicLayoutEffect = typeof window !== "undefined" ? import_react.useLayoutEffect : import_react.useEffect;
/**
* To synchronize the editor instance with the component state,
* we need to create a separate instance that is not affected by the component re-renders.
*/
var EditorStateManager = class {
	constructor(initialEditor) {
		this.transactionNumber = 0;
		this.lastTransactionNumber = 0;
		this.subscribers = /* @__PURE__ */ new Set();
		this.editor = initialEditor;
		this.lastSnapshot = {
			editor: initialEditor,
			transactionNumber: 0
		};
		this.getSnapshot = this.getSnapshot.bind(this);
		this.getServerSnapshot = this.getServerSnapshot.bind(this);
		this.watch = this.watch.bind(this);
		this.subscribe = this.subscribe.bind(this);
	}
	/**
	* Get the current editor instance.
	*/
	getSnapshot() {
		if (this.transactionNumber === this.lastTransactionNumber) return this.lastSnapshot;
		this.lastTransactionNumber = this.transactionNumber;
		this.lastSnapshot = {
			editor: this.editor,
			transactionNumber: this.transactionNumber
		};
		return this.lastSnapshot;
	}
	/**
	* Always disable the editor on the server-side.
	*/
	getServerSnapshot() {
		return {
			editor: null,
			transactionNumber: 0
		};
	}
	/**
	* Subscribe to the editor instance's changes.
	*/
	subscribe(callback) {
		this.subscribers.add(callback);
		return () => {
			this.subscribers.delete(callback);
		};
	}
	/**
	* Watch the editor instance for changes.
	*/
	watch(nextEditor) {
		this.editor = nextEditor;
		if (this.editor) {
			/**
			* This will force a re-render when the editor state changes.
			* This is to support things like `editor.can().toggleBold()` in components that `useEditor`.
			* This could be more efficient, but it's a good trade-off for now.
			*/
			let lastTransaction;
			const fn = (props) => {
				if ((props === null || props === void 0 ? void 0 : props.transaction) !== void 0 && props.transaction === lastTransaction) return;
				lastTransaction = props === null || props === void 0 ? void 0 : props.transaction;
				this.transactionNumber += 1;
				this.subscribers.forEach((callback) => callback());
			};
			const currentEditor = this.editor;
			currentEditor.on("transaction", fn);
			currentEditor.on("update", fn);
			return () => {
				currentEditor.off("transaction", fn);
				currentEditor.off("update", fn);
			};
		}
	}
};
/**
* This hook allows you to watch for changes on the editor instance.
* It will allow you to select a part of the editor state and re-render the component when it changes.
* @example
* ```tsx
* const editor = useEditor({...options})
* const { currentSelection } = useEditorState({
*  editor,
*  selector: snapshot => ({ currentSelection: snapshot.editor.state.selection }),
* })
*/
function useEditorState(options) {
	var _options$equalityFn;
	const [editorStateManager] = (0, import_react.useState)(() => new EditorStateManager(options.editor));
	const selectedState = (0, import_with_selector.useSyncExternalStoreWithSelector)(editorStateManager.subscribe, editorStateManager.getSnapshot, editorStateManager.getServerSnapshot, options.selector, (_options$equalityFn = options.equalityFn) !== null && _options$equalityFn !== void 0 ? _options$equalityFn : deepEqual);
	useIsomorphicLayoutEffect(() => {
		return editorStateManager.watch(options.editor);
	}, [options.editor, editorStateManager]);
	(0, import_react.useDebugValue)(selectedState);
	return selectedState;
}
var isDev = false;
var isSSR = typeof window === "undefined";
var isNext = isSSR || Boolean(typeof window !== "undefined" && window.next);
/**
* This class handles the creation, destruction, and re-creation of the editor instance.
*/
var EditorInstanceManager = class EditorInstanceManager {
	constructor(options) {
		this.editor = null;
		this.subscriptions = /* @__PURE__ */ new Set();
		this.isComponentMounted = false;
		this.previousDeps = null;
		this.instanceId = "";
		this.options = options;
		this.subscriptions = /* @__PURE__ */ new Set();
		this.setEditor(this.getInitialEditor());
		this.scheduleDestroy();
		this.getEditor = this.getEditor.bind(this);
		this.getServerSnapshot = this.getServerSnapshot.bind(this);
		this.subscribe = this.subscribe.bind(this);
		this.refreshEditorInstance = this.refreshEditorInstance.bind(this);
		this.scheduleDestroy = this.scheduleDestroy.bind(this);
		this.onRender = this.onRender.bind(this);
		this.createEditor = this.createEditor.bind(this);
	}
	setEditor(editor) {
		this.editor = editor;
		this.instanceId = Math.random().toString(36).slice(2, 9);
		this.subscriptions.forEach((cb) => cb());
	}
	getInitialEditor() {
		const explicit = this.options.current.immediatelyRender;
		let immediatelyRender = explicit !== null && explicit !== void 0 ? explicit : true;
		if (isSSR) {
			if (immediatelyRender && isDev) console.warn("SSR detected. `immediatelyRender` has been set to false to avoid hydration mismatches");
			immediatelyRender = false;
		} else if (isNext && explicit === void 0) {
			immediatelyRender = false;
			if (isDev) console.warn("Next.js detected. `immediatelyRender` defaults to false to avoid hydration mismatches. Pass `immediatelyRender: true` explicitly if you are rendering the editor only on the client.");
		}
		return immediatelyRender ? this.createEditor() : null;
	}
	/**
	* Create a new editor instance. And attach event listeners.
	*/
	createEditor() {
		const optionsToApply = {
			...this.options.current,
			onBeforeCreate: (...args) => {
				var _this$options$current, _this$options$current2;
				return (_this$options$current = (_this$options$current2 = this.options.current).onBeforeCreate) === null || _this$options$current === void 0 ? void 0 : _this$options$current.call(_this$options$current2, ...args);
			},
			onBlur: (...args) => {
				var _this$options$current3, _this$options$current4;
				return (_this$options$current3 = (_this$options$current4 = this.options.current).onBlur) === null || _this$options$current3 === void 0 ? void 0 : _this$options$current3.call(_this$options$current4, ...args);
			},
			onCreate: (...args) => {
				var _this$options$current5, _this$options$current6;
				return (_this$options$current5 = (_this$options$current6 = this.options.current).onCreate) === null || _this$options$current5 === void 0 ? void 0 : _this$options$current5.call(_this$options$current6, ...args);
			},
			onDestroy: (...args) => {
				var _this$options$current7, _this$options$current8;
				return (_this$options$current7 = (_this$options$current8 = this.options.current).onDestroy) === null || _this$options$current7 === void 0 ? void 0 : _this$options$current7.call(_this$options$current8, ...args);
			},
			onFocus: (...args) => {
				var _this$options$current9, _this$options$current10;
				return (_this$options$current9 = (_this$options$current10 = this.options.current).onFocus) === null || _this$options$current9 === void 0 ? void 0 : _this$options$current9.call(_this$options$current10, ...args);
			},
			onSelectionUpdate: (...args) => {
				var _this$options$current11, _this$options$current12;
				return (_this$options$current11 = (_this$options$current12 = this.options.current).onSelectionUpdate) === null || _this$options$current11 === void 0 ? void 0 : _this$options$current11.call(_this$options$current12, ...args);
			},
			onTransaction: (...args) => {
				var _this$options$current13, _this$options$current14;
				return (_this$options$current13 = (_this$options$current14 = this.options.current).onTransaction) === null || _this$options$current13 === void 0 ? void 0 : _this$options$current13.call(_this$options$current14, ...args);
			},
			onUpdate: (...args) => {
				var _this$options$current15, _this$options$current16;
				return (_this$options$current15 = (_this$options$current16 = this.options.current).onUpdate) === null || _this$options$current15 === void 0 ? void 0 : _this$options$current15.call(_this$options$current16, ...args);
			},
			onContentError: (...args) => {
				var _this$options$current17, _this$options$current18;
				return (_this$options$current17 = (_this$options$current18 = this.options.current).onContentError) === null || _this$options$current17 === void 0 ? void 0 : _this$options$current17.call(_this$options$current18, ...args);
			},
			onDrop: (...args) => {
				var _this$options$current19, _this$options$current20;
				return (_this$options$current19 = (_this$options$current20 = this.options.current).onDrop) === null || _this$options$current19 === void 0 ? void 0 : _this$options$current19.call(_this$options$current20, ...args);
			},
			onPaste: (...args) => {
				var _this$options$current21, _this$options$current22;
				return (_this$options$current21 = (_this$options$current22 = this.options.current).onPaste) === null || _this$options$current21 === void 0 ? void 0 : _this$options$current21.call(_this$options$current22, ...args);
			},
			onDelete: (...args) => {
				var _this$options$current23, _this$options$current24;
				return (_this$options$current23 = (_this$options$current24 = this.options.current).onDelete) === null || _this$options$current23 === void 0 ? void 0 : _this$options$current23.call(_this$options$current24, ...args);
			},
			onMount: (...args) => {
				var _this$options$current25, _this$options$current26;
				return (_this$options$current25 = (_this$options$current26 = this.options.current).onMount) === null || _this$options$current25 === void 0 ? void 0 : _this$options$current25.call(_this$options$current26, ...args);
			},
			onUnmount: (...args) => {
				var _this$options$current27, _this$options$current28;
				return (_this$options$current27 = (_this$options$current28 = this.options.current).onUnmount) === null || _this$options$current27 === void 0 ? void 0 : _this$options$current27.call(_this$options$current28, ...args);
			}
		};
		return new Editor(optionsToApply);
	}
	/**
	* Get the current editor instance.
	*/
	getEditor() {
		return this.editor;
	}
	/**
	* Always disable the editor on the server-side.
	*/
	getServerSnapshot() {
		return null;
	}
	/**
	* Subscribe to the editor instance's changes.
	*/
	subscribe(onStoreChange) {
		this.subscriptions.add(onStoreChange);
		return () => {
			this.subscriptions.delete(onStoreChange);
		};
	}
	static compareOptions(a, b) {
		return Object.keys(a).every((key) => {
			if ([
				"onCreate",
				"onBeforeCreate",
				"onDestroy",
				"onUpdate",
				"onTransaction",
				"onFocus",
				"onBlur",
				"onSelectionUpdate",
				"onContentError",
				"onDrop",
				"onPaste"
			].includes(key)) return true;
			if (key === "extensions" && a.extensions && b.extensions) {
				if (a.extensions.length !== b.extensions.length) return false;
				return a.extensions.every((extension, index) => {
					var _b$extensions;
					if (extension !== ((_b$extensions = b.extensions) === null || _b$extensions === void 0 ? void 0 : _b$extensions[index])) return false;
					return true;
				});
			}
			if (a[key] !== b[key]) return false;
			return true;
		});
	}
	/**
	* On each render, we will create, update, or destroy the editor instance.
	* @param deps The dependencies to watch for changes
	* @returns A cleanup function
	*/
	onRender(deps) {
		return () => {
			this.isComponentMounted = true;
			clearTimeout(this.scheduledDestructionTimeout);
			if (this.editor && !this.editor.isDestroyed && deps.length === 0) {
				if (!EditorInstanceManager.compareOptions(this.options.current, this.editor.options)) this.editor.setOptions({
					...this.options.current,
					editable: this.editor.isEditable
				});
			} else this.refreshEditorInstance(deps);
			return () => {
				this.isComponentMounted = false;
				this.scheduleDestroy();
			};
		};
	}
	/**
	* Recreate the editor instance if the dependencies have changed.
	*/
	refreshEditorInstance(deps) {
		if (this.editor && !this.editor.isDestroyed) {
			if (this.previousDeps === null) {
				this.previousDeps = deps;
				return;
			}
			if (this.previousDeps.length === deps.length && this.previousDeps.every((dep, index) => dep === deps[index])) return;
		}
		if (this.editor && !this.editor.isDestroyed) this.editor.destroy();
		this.setEditor(this.createEditor());
		this.previousDeps = deps;
	}
	/**
	* Schedule the destruction of the editor instance.
	* This will only destroy the editor if it was not mounted on the next tick.
	* This is to avoid destroying the editor instance when it's actually still mounted.
	*/
	scheduleDestroy() {
		const currentInstanceId = this.instanceId;
		const currentEditor = this.editor;
		this.scheduledDestructionTimeout = setTimeout(() => {
			if (this.isComponentMounted && this.instanceId === currentInstanceId) {
				if (currentEditor) currentEditor.setOptions(this.options.current);
				return;
			}
			if (currentEditor && !currentEditor.isDestroyed) {
				currentEditor.destroy();
				if (this.instanceId === currentInstanceId) this.setEditor(null);
			}
		}, 1);
	}
};
function useEditor(options = {}, deps = []) {
	const mostRecentOptions = (0, import_react.useRef)(options);
	mostRecentOptions.current = options;
	const [instanceManager] = (0, import_react.useState)(() => new EditorInstanceManager(mostRecentOptions));
	const editor = (0, import_shim.useSyncExternalStore)(instanceManager.subscribe, instanceManager.getEditor, instanceManager.getServerSnapshot);
	(0, import_react.useDebugValue)(editor);
	(0, import_react.useEffect)(instanceManager.onRender(deps));
	useEditorState({
		editor,
		selector: ({ transactionNumber }) => {
			if (options.shouldRerenderOnTransaction === false || options.shouldRerenderOnTransaction === void 0) return null;
			if (options.immediatelyRender && transactionNumber === 0) return 0;
			return transactionNumber + 1;
		}
	});
	return editor;
}
var EditorContext = (0, import_react.createContext)({ editor: null });
var EditorConsumer = EditorContext.Consumer;
/**
* A hook to get the current editor instance.
*/
var useCurrentEditor = () => (0, import_react.useContext)(EditorContext);
/**
* This is the provider component for the editor.
* It allows the editor to be accessible across the entire component tree
* with `useCurrentEditor`.
*/
function EditorProvider({ children, slotAfter, slotBefore, editorContainerProps = {}, ...editorOptions }) {
	const editor = useEditor(editorOptions);
	const contextValue = (0, import_react.useMemo)(() => ({ editor }), [editor]);
	if (!editor) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(EditorContext.Provider, {
		value: contextValue,
		children: [
			slotBefore,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorConsumer, { children: ({ editor: currentEditor }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorContent, {
				editor: currentEditor,
				...editorContainerProps
			}) }),
			children,
			slotAfter
		]
	});
}
var ReactNodeViewContext = (0, import_react.createContext)({
	onDragStart: () => {},
	nodeViewContentChildren: void 0,
	nodeViewContentRef: () => {}
});
var ReactNodeViewContentProvider = ({ children, content }) => {
	return (0, import_react.createElement)(ReactNodeViewContext.Provider, { value: { nodeViewContentChildren: content } }, children);
};
var useReactNodeView = () => (0, import_react.useContext)(ReactNodeViewContext);
function NodeViewContent({ as: Tag = "div", ...props }) {
	const { nodeViewContentRef, nodeViewContentChildren } = useReactNodeView();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, {
		...props,
		ref: nodeViewContentRef,
		"data-node-view-content": "",
		style: {
			whiteSpace: "pre-wrap",
			...props.style
		},
		children: nodeViewContentChildren
	});
}
var NodeViewWrapper = import_react.forwardRef((props, ref) => {
	const { onDragStart } = useReactNodeView();
	const Tag = props.as || "div";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, {
		...props,
		ref,
		"data-node-view-wrapper": "",
		onDragStart,
		style: {
			whiteSpace: "normal",
			...props.style
		}
	});
});
/**
* Check if a component is a class component.
* @param Component
* @returns {boolean}
*/
function isClassComponent(Component) {
	return !!(typeof Component === "function" && Component.prototype && Component.prototype.isReactComponent);
}
/**
* Check if a component is a forward ref component.
* @param Component
* @returns {boolean}
*/
function isForwardRefComponent(Component) {
	return !!(typeof Component === "object" && Component.$$typeof && (Component.$$typeof.toString() === "Symbol(react.forward_ref)" || Component.$$typeof.description === "react.forward_ref"));
}
/**
* Check if a component is a memoized component.
* @param Component
* @returns {boolean}
*/
function isMemoComponent(Component) {
	return !!(typeof Component === "object" && Component.$$typeof && (Component.$$typeof.toString() === "Symbol(react.memo)" || Component.$$typeof.description === "react.memo"));
}
/**
* Check if a component can safely receive a ref prop.
* This includes class components, forwardRef components, and memoized components
* that wrap forwardRef or class components.
* @param Component
* @returns {boolean}
*/
function canReceiveRef(Component) {
	if (isClassComponent(Component)) return true;
	if (isForwardRefComponent(Component)) return true;
	if (isMemoComponent(Component)) {
		const wrappedComponent = Component.type;
		if (wrappedComponent) return isClassComponent(wrappedComponent) || isForwardRefComponent(wrappedComponent);
	}
	return false;
}
/**
* Check if we're running React 19+ by detecting if function components support ref props
* @returns {boolean}
*/
function isReact19Plus() {
	try {
		if (import_react.version) return parseInt(import_react.version.split(".")[0], 10) >= 19;
	} catch {}
	return false;
}
/**
* The ReactRenderer class. It's responsible for rendering React components inside the editor.
* @example
* new ReactRenderer(MyComponent, {
*   editor,
*   props: {
*     foo: 'bar',
*   },
*   as: 'span',
* })
*/
var ReactRenderer = class {
	/**
	* Immediately creates element and renders the provided React component.
	*/
	constructor(component, { editor, props = {}, as = "div", className = "" }) {
		this.ref = null;
		this.destroyed = false;
		this.id = Math.floor(Math.random() * 4294967295).toString();
		this.component = component;
		this.editor = editor;
		this.props = props;
		this.element = document.createElement(as);
		this.element.classList.add("react-renderer");
		if (className) this.element.classList.add(...className.split(" "));
		if (this.editor.isEditorContentInitialized) (0, import_react_dom.flushSync)(() => {
			this.render();
		});
		else queueMicrotask(() => {
			if (this.destroyed) return;
			this.render();
		});
	}
	/**
	* Render the React component.
	*/
	render() {
		var _editor$contentCompon;
		if (this.destroyed) return;
		const Component = this.component;
		const props = this.props;
		const editor = this.editor;
		const isReact19 = isReact19Plus();
		const componentCanReceiveRef = canReceiveRef(Component);
		const elementProps = { ...props };
		if (elementProps.ref && !(isReact19 || componentCanReceiveRef)) delete elementProps.ref;
		if (!elementProps.ref && (isReact19 || componentCanReceiveRef)) elementProps.ref = (ref) => {
			this.ref = ref;
		};
		this.reactElement = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Component, { ...elementProps });
		editor === null || editor === void 0 || (_editor$contentCompon = editor.contentComponent) === null || _editor$contentCompon === void 0 || _editor$contentCompon.setRenderer(this.id, this);
	}
	/**
	* Re-renders the React component with new props.
	* Skips the render if none of the supplied props actually changed,
	* to avoid unnecessary portal re-creation.
	*/
	updateProps(props = {}) {
		if (this.destroyed) return;
		let changed = false;
		const keys = Object.keys(props);
		for (let i = 0; i < keys.length; i += 1) {
			const key = keys[i];
			if (props[key] !== this.props[key]) {
				changed = true;
				break;
			}
		}
		if (!changed) return;
		this.props = {
			...this.props,
			...props
		};
		this.render();
	}
	/**
	* Destroy the React component.
	*/
	destroy() {
		var _editor$contentCompon2;
		this.destroyed = true;
		const editor = this.editor;
		editor === null || editor === void 0 || (_editor$contentCompon2 = editor.contentComponent) === null || _editor$contentCompon2 === void 0 || _editor$contentCompon2.removeRenderer(this.id);
		try {
			if (this.element && this.element.parentNode) this.element.parentNode.removeChild(this.element);
		} catch {}
	}
	/**
	* Update the attributes of the element that holds the React component.
	*/
	updateAttributes(attributes) {
		Object.keys(attributes).forEach((key) => {
			this.element.setAttribute(key, attributes[key]);
		});
	}
};
var ReactMarkViewContext = import_react.createContext({ markViewContentRef: () => {} });
var MarkViewContent = (props) => {
	const { as: Tag = "span", ...rest } = props;
	const { markViewContentRef } = import_react.useContext(ReactMarkViewContext);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, {
		...rest,
		ref: markViewContentRef,
		"data-mark-view-content": ""
	});
};
var ReactMarkView = class extends MarkView {
	constructor(component, props, options) {
		super(component, props, options);
		const { as = "span", attrs, className = "" } = options || {};
		const componentProps = {
			...props,
			updateAttributes: this.updateAttributes.bind(this)
		};
		this.contentDOMElement = document.createElement("span");
		const markViewContentRef = (el) => {
			if (el && !el.contains(this.contentDOMElement)) el.appendChild(this.contentDOMElement);
		};
		const context = { markViewContentRef };
		const ReactMarkViewProvider = import_react.memo((componentProps) => {
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReactMarkViewContext.Provider, {
				value: context,
				children: import_react.createElement(component, componentProps)
			});
		});
		ReactMarkViewProvider.displayName = "ReactMarkView";
		this.renderer = new ReactRenderer(ReactMarkViewProvider, {
			editor: props.editor,
			props: componentProps,
			as,
			className: `mark-${props.mark.type.name} ${className}`.trim()
		});
		if (attrs) this.renderer.updateAttributes(attrs);
	}
	get dom() {
		return this.renderer.element;
	}
	get contentDOM() {
		return this.contentDOMElement;
	}
};
function ReactMarkViewRenderer(component, options = {}) {
	return (props) => new ReactMarkView(component, props, options);
}
/**
* Saves the DOM selection inside `element`, returns a function to put it back.
* Browsers drop the selection when an element moves, so restore it after the move.
*/
function captureDOMSelection(element) {
	var _element$ownerDocumen;
	const root = element.getRootNode();
	const selection = typeof root.getSelection === "function" ? root.getSelection() : (_element$ownerDocumen = element.ownerDocument) === null || _element$ownerDocumen === void 0 || (_element$ownerDocumen = _element$ownerDocumen.defaultView) === null || _element$ownerDocumen === void 0 ? void 0 : _element$ownerDocumen.getSelection();
	if (!selection || selection.rangeCount === 0) return null;
	const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
	if (!anchorNode || !focusNode) return null;
	if (!element.contains(anchorNode) || !element.contains(focusNode)) return null;
	return () => {
		try {
			selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
		} catch {}
	};
}
function isSameAncestor($from, $to, depth) {
	return $from.node(depth) === $to.node(depth) && $from.before(depth) === $to.before(depth);
}
function getTextSelectionAncestorPositions(selection) {
	if (!isTextSelection(selection)) return [];
	const { $from, $to } = selection;
	const positions = [];
	const maxDepth = Math.min($from.depth, $to.depth);
	for (let depth = 1; depth <= maxDepth; depth += 1) {
		if (!isSameAncestor($from, $to, depth)) break;
		positions.push($from.before(depth));
	}
	return positions;
}
var ReactNodeViewSelectionTracker = class {
	constructor(editor) {
		this.views = /* @__PURE__ */ new WeakMap();
		this.viewCount = 0;
		this.insideViews = /* @__PURE__ */ new Set();
		this.syncQueued = false;
		this.scheduleSync = () => {
			if (this.syncQueued) return;
			this.syncQueued = true;
			queueMicrotask(() => {
				this.syncQueued = false;
				this.sync();
			});
		};
		this.handleTransaction = () => this.scheduleSync();
		this.editor = editor;
	}
	register(view) {
		if (this.viewCount === 0) this.editor.on("transaction", this.handleTransaction);
		this.views.set(view.dom, view);
		this.viewCount += 1;
		this.scheduleSync();
	}
	unregister(view) {
		this.views.delete(view.dom);
		this.viewCount -= 1;
		this.insideViews.delete(view);
		if (this.viewCount === 0) this.editor.off("transaction", this.handleTransaction);
	}
	sync() {
		if (this.viewCount === 0 || this.editor.isDestroyed) return;
		const nextInsideViews = this.findInsideViews();
		this.updateViews(this.insideViews, nextInsideViews, false);
		this.updateViews(nextInsideViews, this.insideViews, true);
		this.insideViews = nextInsideViews;
	}
	updateViews(views, unchangedViews, selectionInside) {
		for (const view of views) if (!unchangedViews.has(view)) view.setSelectionInside(selectionInside);
	}
	findInsideViews() {
		const insideViews = /* @__PURE__ */ new Set();
		for (const position of getTextSelectionAncestorPositions(this.editor.state.selection)) {
			const dom = this.editor.view.nodeDOM(position);
			const view = dom ? this.views.get(dom) : void 0;
			if (view) insideViews.add(view);
		}
		return insideViews;
	}
};
var trackers = /* @__PURE__ */ new WeakMap();
function getReactNodeViewSelectionTracker(editor) {
	let tracker = trackers.get(editor);
	if (!tracker) {
		tracker = new ReactNodeViewSelectionTracker(editor);
		trackers.set(editor, tracker);
	}
	return tracker;
}
var ReactNodeView = class extends NodeView {
	constructor(component, props, options) {
		super(component, props, options);
		this.nodeSelected = false;
		this.handlePositionUpdate = () => {
			const newPos = this.getPos();
			if (typeof newPos !== "number" || newPos === this.currentPos) return;
			this.currentPos = newPos;
			this.renderer.updateProps({ getPos: () => this.getPos() });
			if (typeof this.options.attrs === "function") this.updateElementAttributes();
		};
		this.cachedExtensionWithSyncedStorage = null;
		if (!this.node.isLeaf) {
			if (this.options.contentDOMElementTag) this.contentDOMElement = document.createElement(this.options.contentDOMElementTag);
			else this.contentDOMElement = document.createElement(this.node.isInline ? "span" : "div");
			this.contentDOMElement.dataset.nodeViewContentReact = "";
			this.contentDOMElement.dataset.nodeViewWrapper = "";
			this.contentDOMElement.style.whiteSpace = "inherit";
			const contentTarget = this.dom.querySelector("[data-node-view-content]");
			if (contentTarget) contentTarget.appendChild(this.contentDOMElement);
			else this.dom.appendChild(this.contentDOMElement);
		}
		if (this.options.trackNodeViewPosition) this.editor.on("update", this.handlePositionUpdate);
	}
	/**
	* Returns a proxy of the extension that redirects storage access to the editor's mutable storage.
	* This preserves the original prototype chain (instanceof checks, methods like configure/extend work).
	* Cached to avoid proxy creation on every update.
	*/
	get extensionWithSyncedStorage() {
		if (!this.cachedExtensionWithSyncedStorage) {
			const editor = this.editor;
			const extension = this.extension;
			this.cachedExtensionWithSyncedStorage = new Proxy(extension, { get(target, prop, receiver) {
				if (prop === "storage") {
					var _editor$storage;
					return (_editor$storage = editor.storage[extension.name]) !== null && _editor$storage !== void 0 ? _editor$storage : {};
				}
				return Reflect.get(target, prop, receiver);
			} });
		}
		return this.cachedExtensionWithSyncedStorage;
	}
	/**
	* Setup the React component.
	* Called on initialization.
	*/
	mount() {
		const mountProps = {
			editor: this.editor,
			node: this.node,
			decorations: this.decorations,
			innerDecorations: this.innerDecorations,
			view: this.view,
			selected: false,
			selectionInside: false,
			extension: this.extensionWithSyncedStorage,
			HTMLAttributes: this.HTMLAttributes,
			getPos: () => this.getPos(),
			updateAttributes: (attributes = {}) => this.updateAttributes(attributes),
			deleteNode: () => this.deleteNode(),
			ref: (0, import_react.createRef)()
		};
		if (!this.component.displayName) {
			const capitalizeFirstChar = (string) => {
				return string.charAt(0).toUpperCase() + string.substring(1);
			};
			this.component.displayName = capitalizeFirstChar(this.extension.name);
		}
		const onDragStart = this.onDragStart.bind(this);
		const nodeViewContentRef = (element) => {
			if (element && this.contentDOMElement && element.firstChild !== this.contentDOMElement) {
				if (element.hasAttribute("data-node-view-wrapper")) element.removeAttribute("data-node-view-wrapper");
				const restoreSelection = captureDOMSelection(this.contentDOMElement);
				element.appendChild(this.contentDOMElement);
				restoreSelection === null || restoreSelection === void 0 || restoreSelection();
			}
		};
		const context = {
			onDragStart,
			nodeViewContentRef
		};
		const Component = this.component;
		const ReactNodeViewProvider = (0, import_react.memo)((componentProps) => {
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReactNodeViewContext.Provider, {
				value: context,
				children: (0, import_react.createElement)(Component, componentProps)
			});
		});
		ReactNodeViewProvider.displayName = "ReactNodeView";
		let as = this.node.isInline ? "span" : "div";
		if (this.options.as) as = this.options.as;
		const { className = "" } = this.options;
		this.renderer = new ReactRenderer(ReactNodeViewProvider, {
			editor: this.editor,
			props: mountProps,
			as,
			className: `node-${this.node.type.name} ${className}`.trim()
		});
		getReactNodeViewSelectionTracker(this.editor).register(this);
		this.updateElementAttributes();
		this.currentPos = this.getPos();
	}
	/**
	* Return the DOM element.
	* This is the element that will be used to display the node view.
	*/
	get dom() {
		var _this$renderer$elemen;
		if (this.renderer.element.firstElementChild && !((_this$renderer$elemen = this.renderer.element.firstElementChild) === null || _this$renderer$elemen === void 0 ? void 0 : _this$renderer$elemen.hasAttribute("data-node-view-wrapper"))) throw Error("Please use the NodeViewWrapper component for your node view.");
		return this.renderer.element;
	}
	/**
	* Return the content DOM element.
	* This is the element that will be used to display the rich-text content of the node.
	*/
	get contentDOM() {
		if (this.node.isLeaf) return null;
		return this.contentDOMElement;
	}
	/**
	* On update, update the React component.
	* To prevent unnecessary updates, the `update` option can be used.
	*/
	update(node, decorations, innerDecorations) {
		const rerenderComponent = (props) => {
			this.renderer.updateProps(props);
			if (typeof this.options.attrs === "function") this.updateElementAttributes();
		};
		if (node.type !== this.node.type) return false;
		if (typeof this.options.update === "function") {
			const oldNode = this.node;
			const oldDecorations = this.decorations;
			const oldInnerDecorations = this.innerDecorations;
			this.node = node;
			this.decorations = decorations;
			this.innerDecorations = innerDecorations;
			this.currentPos = this.getPos();
			return this.options.update({
				oldNode,
				oldDecorations,
				newNode: node,
				newDecorations: decorations,
				oldInnerDecorations,
				innerDecorations,
				updateProps: () => rerenderComponent({
					node,
					decorations,
					innerDecorations,
					extension: this.extensionWithSyncedStorage
				})
			});
		}
		if (!(node !== this.node)) {
			this.node = node;
			this.decorations = decorations;
			this.innerDecorations = innerDecorations;
			return true;
		}
		const newPos = this.getPos();
		this.node = node;
		this.decorations = decorations;
		this.innerDecorations = innerDecorations;
		this.currentPos = newPos;
		const extraProps = {
			node,
			decorations,
			innerDecorations,
			extension: this.extensionWithSyncedStorage
		};
		if (this.options.trackNodeViewPosition) extraProps.getPos = () => this.getPos();
		rerenderComponent(extraProps);
		return true;
	}
	/**
	* Select the node.
	* Add the `selected` prop and the `ProseMirror-selectednode` class.
	*/
	selectNode() {
		this.nodeSelected = true;
		this.updateSelectedState(true);
	}
	/**
	* Deselect the node.
	* Remove the `selected` prop and the `ProseMirror-selectednode` class.
	*/
	deselectNode() {
		this.nodeSelected = false;
		this.updateSelectedState(this.options.selectedOnTextSelection === true && this.isTextSelectionInside());
	}
	setSelectionInside(selectionInside) {
		const selected = this.nodeSelected || this.options.selectedOnTextSelection === true && selectionInside;
		this.renderer.updateProps({
			selectionInside,
			selected
		});
		this.renderer.element.classList.toggle("ProseMirror-selectednode", selected);
	}
	updateSelectedState(selected) {
		this.renderer.updateProps({ selected });
		this.renderer.element.classList.toggle("ProseMirror-selectednode", selected);
	}
	isTextSelectionInside() {
		const pos = this.getPos();
		return typeof pos === "number" && getTextSelectionAncestorPositions(this.editor.state.selection).includes(pos);
	}
	/**
	* Destroy the React component instance.
	*/
	destroy() {
		this.renderer.destroy();
		getReactNodeViewSelectionTracker(this.editor).unregister(this);
		if (this.options.trackNodeViewPosition) this.editor.off("update", this.handlePositionUpdate);
		this.contentDOMElement = null;
	}
	/**
	* Update the attributes of the top-level element that holds the React component.
	* Applying the attributes defined in the `attrs` option.
	*/
	updateElementAttributes() {
		if (this.options.attrs) {
			let attrsObj = {};
			if (typeof this.options.attrs === "function") {
				const extensionAttributes = this.editor.extensionManager.attributes;
				const HTMLAttributes = getRenderedAttributes(this.node, extensionAttributes);
				attrsObj = this.options.attrs({
					node: this.node,
					HTMLAttributes
				});
			} else attrsObj = this.options.attrs;
			this.renderer.updateAttributes(attrsObj);
		}
	}
};
/**
* Create a React node view renderer.
*/
function ReactNodeViewRenderer(component, options) {
	return (props) => {
		if (!props.editor.contentComponent) return {
			dom: document.createElement("span"),
			contentDOM: null,
			update: () => false,
			destroy: () => {},
			selectNode: () => {},
			deselectNode: () => {},
			stopEvent: () => false,
			ignoreMutation: () => true
		};
		return new ReactNodeView(component, props, options);
	};
}
var WIDGET_CACHE = Symbol("tiptapReactWidgetCache");
/**
* Renders a React component into a ProseMirror widget decoration.
* Reuses Tiptap's `ReactRenderer` so the component lives in the editor's
* React tree (context and hooks work as usual). Use a stable `key` for
* stateful widgets.
* @example
* addDecorations() {
*   return {
*     create: ({ editor, state }) =>
*       findMatches(state.doc).map(match =>
*         ReactWidgetRenderer(MyWidget, {
*           editor, pos: match.pos, key: `match-${match.id}`,
*           props: { label: match.label },
*         }),
*       ),
*   }
* }
*/
function ReactWidgetRenderer(component, options) {
	const { editor, props = {}, as = "span", className } = options;
	return createWidgetDecoration({
		...options,
		props,
		cacheKey: WIDGET_CACHE,
		context: (getPos) => ({
			editor,
			getPos
		}),
		create: (renderProps) => new ReactRenderer(component, {
			editor,
			as,
			className,
			props: renderProps
		}),
		materialize: (renderer) => {
			renderer.render();
			return renderer.element;
		}
	});
}
/**
* React context that stores the current editor instance.
*
* Use `useTiptap()` to read from this context in child components.
*/
var TiptapContext = (0, import_react.createContext)({ get editor() {
	throw new Error("useTiptap must be used within a <Tiptap> provider");
} });
TiptapContext.displayName = "TiptapContext";
/**
* Hook to read the Tiptap context and access the editor instance.
*
* This is a small convenience wrapper around `useContext(TiptapContext)`.
* The editor is always available when used within a `<Tiptap>` provider.
*
* @returns The current `TiptapContextType` value from the provider.
*
* @example
* ```tsx
* import { useTiptap } from '@tiptap/react'
*
* function Toolbar() {
*   const { editor } = useTiptap()
*
*   return (
*     <button onClick={() => editor.chain().focus().toggleBold().run()}>
*       Bold
*     </button>
*   )
* }
* ```
*/
var useTiptap = () => (0, import_react.useContext)(TiptapContext);
/**
* Select a slice of the editor state using the context-provided editor.
*
* This is a thin wrapper around `useEditorState` that reads the `editor`
* instance from `useTiptap()` so callers don't have to pass it manually.
*
* @typeParam TSelectorResult - The type returned by the selector.
* @param selector - Function that receives the editor state snapshot and
*                   returns the piece of state you want to subscribe to.
* @param equalityFn - Optional function to compare previous/next selected
*                     values and avoid unnecessary updates.
* @returns The selected slice of the editor state.
*
* @example
* ```tsx
* function WordCount() {
*   const wordCount = useTiptapState(state => {
*     const text = state.editor.state.doc.textContent
*     return text.split(/\s+/).filter(Boolean).length
*   })
*
*   return <span>{wordCount} words</span>
* }
* ```
*/
function useTiptapState(selector, equalityFn) {
	const { editor } = useTiptap();
	return useEditorState({
		editor,
		selector,
		equalityFn
	});
}
/**
* Top-level provider component that makes the editor instance available via
* React context to all child components.
*
* This component also provides backwards compatibility with the legacy
* `EditorContext`, so components using `useCurrentEditor()` will work
* inside a `<Tiptap>` provider.
*
* @param props - Component props.
* @returns A context provider element wrapping `children`.
*
* @example
* ```tsx
* import { Tiptap, useEditor } from '@tiptap/react'
*
* function App() {
*   const editor = useEditor({ extensions: [...] })
*
*   return (
*     <Tiptap editor={editor}>
*       <Toolbar />
*       <Tiptap.Content />
*     </Tiptap>
*   )
* }
* ```
*/
function TiptapWrapper({ children, ...props }) {
	const resolvedEditor = "editor" in props ? props.editor : props.instance;
	if (!resolvedEditor) throw new Error("Tiptap: An editor instance is required. Pass a non-null `editor` prop.");
	const tiptapContextValue = (0, import_react.useMemo)(() => ({ editor: resolvedEditor }), [resolvedEditor]);
	const legacyContextValue = (0, import_react.useMemo)(() => ({ editor: resolvedEditor }), [resolvedEditor]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorContext.Provider, {
		value: legacyContextValue,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TiptapContext.Provider, {
			value: tiptapContextValue,
			children
		})
	});
}
TiptapWrapper.displayName = "Tiptap";
/**
* Convenience component that renders `EditorContent` using the context-provided
* editor instance. Use this instead of manually passing the `editor` prop.
*
* @param props - All `EditorContent` props except `editor` and `ref`.
* @returns An `EditorContent` element bound to the context editor.
*
* @example
* ```tsx
* // inside a Tiptap provider
* <Tiptap.Content className="editor" />
* ```
*/
function TiptapContent({ ...rest }) {
	const { editor } = useTiptap();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorContent, {
		editor,
		...rest
	});
}
TiptapContent.displayName = "Tiptap.Content";
/**
* Root `Tiptap` component. Use it as the provider for all child components.
*
* The exported object includes the `Content` subcomponent for rendering the
* editor content area.
*
* This component provides both the new `TiptapContext` (accessed via `useTiptap()`)
* and the legacy `EditorContext` (accessed via `useCurrentEditor()`) for
* backwards compatibility.
*
* For bubble menus and floating menus, import them separately from
* `@tiptap/react/menus` to keep floating-ui as an optional dependency.
*
* @example
* ```tsx
* import { Tiptap, useEditor } from '@tiptap/react'
* import { BubbleMenu } from '@tiptap/react/menus'
*
* function App() {
*   const editor = useEditor({ extensions: [...] })
*
*   return (
*     <Tiptap editor={editor}>
*       <Tiptap.Content />
*       <BubbleMenu>
*         <button onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
*       </BubbleMenu>
*     </Tiptap>
*   )
* }
* ```
*/
var Tiptap = Object.assign(TiptapWrapper, { 
/**
* The Tiptap Content component that renders the EditorContent with the editor instance from the context.
* @see TiptapContent
*/
Content: TiptapContent });
//#endregion
export { CommandManager, DECORATION_MANAGER_PLUGIN_KEY, Decoration, DecorationManager, Editor, EditorConsumer, EditorContent, EditorContext, EditorProvider, Extendable, Extension, Fragment, InlineDecoration, InputRule, MappablePosition, Mark, MarkView, MarkViewContent, Node, NodeDecoration, NodePos, NodeView, NodeViewContent, NodeViewWrapper, PasteRule, PureEditorContent, ReactMarkView, ReactMarkViewContext, ReactMarkViewRenderer, ReactNodeView, ReactNodeViewContentProvider, ReactNodeViewContext, ReactNodeViewRenderer, ReactRenderer, ReactWidgetRenderer, ResizableNodeView, ResizableNodeview, Tiptap, TiptapContent, TiptapContext, TiptapWrapper, Tracker, WidgetDecoration, attrsEqual, callOrReturn, canInsertNode, combineTransactionSteps, commands_exports as commands, createAtomBlockMarkdownSpec, createBlockMarkdownSpec, createChainableState, createContentComponent, createDocument, h as createElement, h, createInlineMarkdownSpec, createMappablePosition, createNodeFromContent, createStyleTag, createWidgetDecoration, decodeHtmlEntities, defaultBlockAt, deleteProps, elementFromString, encodeHtmlEntities, escapeForRegEx, extensions_exports as extensions, findChildren, findChildrenInRange, findDuplicates, findParentNode, findParentNodeClosestToPos, flattenExtensions, fromString, generateHTML, generateJSON, generateText, getAttributes, getAttributesFromExtensions, getChangedRanges, getDebugJSON, getExtensionField, getHTMLFromFragment, getMarkAttributes, getMarkRange, getMarkType, getMarksBetween, getNodeAtPosition, getNodeAttributes, getNodeType, getPreviousBlockSibling, getRenderedAttributes, getSchema, getSchemaByResolvedExtensions, getSchemaTypeByName, getSchemaTypeNameByName, getSplittedAttributes, getStyleProperty, getText, getTextBetween, getTextContentFromNodes, getTextSerializersFromSchema, getUpdatedPosition, injectExtensionAttributesToParseRule, inputRulesPlugin, isActive, isAndroid, isAtEndOfNode, isAtStartOfNode, isEmptyObject, isExtensionRulesEnabled, isFirefox, isFunction, isList, isMacOS, isMarkActive, isNodeActive, isNodeEmpty, isNodeSelection, isNodeViewSelected, isNumber, isPlainObject, isProseMirrorAddMarkStep, isProseMirrorAddNodeMarkStep, isProseMirrorAttrStep, isProseMirrorCellSelection, isProseMirrorDocAttrStep, isProseMirrorFragment, isProseMirrorNodeSelection, isProseMirrorRemoveMarkStep, isProseMirrorRemoveNodeMarkStep, isProseMirrorReplaceAroundStep, isProseMirrorReplaceStep, isProseMirrorSlice, isProseMirrorStep, isProseMirrorStepResult, isRegExp, isSafari, isString, isTextSelection, isValidCSSStyleValue, isiOS, liveWidgetKeys, markInputRule, markPasteRule, markdown_exports as markdown, marksEqual, mergeAttributes, mergeDeep, minMax, nodeInputRule, nodePasteRule, objectIncludes, parseAttributes, parseIndentedBlocks, pasteRulesPlugin, posToDOMRect, removeDuplicates, renderNestedMarkdownContent, resolveExtensions, resolveFocusPosition, rewriteUnknownContent, selectionToInsertionEnd, serializeAttributes, sortExtensions, splitExtensions, textInputRule, textPasteRule, textblockTypeInputRule, updateMarkViewAttributes, useCurrentEditor, useEditor, useEditorState, useReactNodeView, useTiptap, useTiptapState, wrappingInputRule };

//# sourceMappingURL=dist-BTpyEED9.js.map
import { contains } from "./dom.ts";
import { isApple } from "./platform.ts";

/**
 * Returns `true` if `event` has been fired within a React Portal element.
 */
export function isPortalEvent(
  event: Pick<Event, "currentTarget" | "target">,
): boolean {
  return Boolean(
    event.currentTarget &&
      !contains(event.currentTarget as Node, event.target as Element),
  );
}

/**
 * Returns `true` if `event.target` and `event.currentTarget` are the same.
 */
export function isSelfTarget(
  event: Pick<Event, "target" | "currentTarget">,
): boolean {
  return event.target === event.currentTarget;
}

/**
 * Checks whether the user event is triggering a page navigation in a new tab.
 */
export function isOpeningInNewTab(
  event: Pick<MouseEvent, "currentTarget" | "metaKey" | "ctrlKey">,
) {
  const element = event.currentTarget as
    | HTMLAnchorElement
    | HTMLButtonElement
    | HTMLInputElement
    | null;
  if (!element) return false;
  const isAppleDevice = isApple();
  if (isAppleDevice && !event.metaKey) return false;
  if (!isAppleDevice && !event.ctrlKey) return false;
  const tagName = element.tagName.toLowerCase();
  if (tagName === "a") return true;
  if (tagName === "button" && element.type === "submit") return true;
  if (tagName === "input" && element.type === "submit") return true;
  return false;
}

/**
 * Checks whether the user event is triggering a download.
 */
export function isDownloading(
  event: Pick<MouseEvent, "altKey" | "currentTarget">,
) {
  const element = event.currentTarget as
    | HTMLAnchorElement
    | HTMLButtonElement
    | HTMLInputElement
    | null;
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  if (!event.altKey) return false;
  if (tagName === "a") return true;
  if (tagName === "button" && element.type === "submit") return true;
  if (tagName === "input" && element.type === "submit") return true;
  return false;
}

/**
 * Creates and dispatches an event.
 * @example
 * fireEvent(document.getElementById("id"), "blur", {
 *   bubbles: true,
 *   cancelable: true,
 * });
 */
export function fireEvent(
  element: Element,
  type: string,
  eventInit?: EventInit,
) {
  const event = new Event(type, eventInit);
  return element.dispatchEvent(event);
}

/**
 * Creates and dispatches a blur event.
 * @example
 * fireBlurEvent(document.getElementById("id"));
 */
export function fireBlurEvent(element: Element, eventInit?: FocusEventInit) {
  const event = new FocusEvent("blur", eventInit);
  const defaultAllowed = element.dispatchEvent(event);
  const bubbleInit = { ...eventInit, bubbles: true };
  element.dispatchEvent(new FocusEvent("focusout", bubbleInit));
  return defaultAllowed;
}

/**
 * Creates and dispatches a focus event.
 * @example
 * fireFocusEvent(document.getElementById("id"));
 */
export function fireFocusEvent(element: Element, eventInit?: FocusEventInit) {
  const event = new FocusEvent("focus", eventInit);
  const defaultAllowed = element.dispatchEvent(event);
  const bubbleInit = { ...eventInit, bubbles: true };
  element.dispatchEvent(new FocusEvent("focusin", bubbleInit));
  return defaultAllowed;
}

/**
 * Creates and dispatches a keyboard event.
 * @example
 * fireKeyboardEvent(document.getElementById("id"), "keydown", {
 *   key: "ArrowDown",
 *   shiftKey: true,
 * });
 */
export function fireKeyboardEvent(
  element: Element,
  type: string,
  eventInit?: KeyboardEventInit,
) {
  const event = new KeyboardEvent(type, eventInit);
  return element.dispatchEvent(event);
}

/**
 * Creates and dispatches a click event.
 * @example
 * fireClickEvent(document.getElementById("id"));
 */
export function fireClickEvent(element: Element, eventInit?: PointerEventInit) {
  const event = new MouseEvent("click", eventInit);
  return element.dispatchEvent(event);
}

/**
 * Checks whether the focus/blur event is happening from/to outside of the
 * container element.
 * @example
 * const element = document.getElementById("id");
 * element.addEventListener("blur", (event) => {
 *   if (isFocusEventOutside(event)) {
 *     // ...
 *   }
 * });
 */
export function isFocusEventOutside(
  event: Pick<FocusEvent, "currentTarget" | "relatedTarget">,
  container?: Element | null,
) {
  const containerElement = container || (event.currentTarget as Element);
  const relatedTarget = event.relatedTarget as HTMLElement | null;
  return !relatedTarget || !contains(containerElement, relatedTarget);
}

/**
 * Returns the `inputType` property of the event, if available.
 */
export function getInputType(event: Event | { nativeEvent: Event }) {
  const nativeEvent = "nativeEvent" in event ? event.nativeEvent : event;
  if (!nativeEvent) return;
  if (!("inputType" in nativeEvent)) return;
  if (typeof nativeEvent.inputType !== "string") return;
  return nativeEvent.inputType;
}

/**
 * Runs a callback on the next animation frame, but before a certain event.
 */
export function queueBeforeEvent(
  element: Element,
  type: string,
  callback: () => void,
  timeout?: number,
) {
  const createTimer = (callback: () => void) => {
    if (timeout) {
      const timerId = setTimeout(callback, timeout);
      return () => clearTimeout(timerId);
    }
    const timerId = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(timerId);
  };

  const cancelTimer = createTimer(() => {
    element.removeEventListener(type, callSync, true);
    callback();
  });
  const callSync = () => {
    cancelTimer();
    callback();
  };
  // By listening to the event in the capture phase, we make sure the callback
  // is fired before the respective React events.
  element.addEventListener(type, callSync, { once: true, capture: true });
  return cancelTimer;
}

export function addGlobalEventListener<K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions,
  scope?: Window,
): () => void;
export function addGlobalEventListener(
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
  scope?: Window,
): () => void;

/**
 * Adds a global event listener, including on child frames.
 */
export function addGlobalEventListener(
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
  scope: Window = window,
) {
  const children: Array<() => void> = [];

  // Prevent errors from "sandbox" frames.
  try {
    scope.addEventListener(type, listener, options);
    for (const frame of Array.from(scope.frames)) {
      children.push(addGlobalEventListener(type, listener, options, frame));
    }
  } catch {}

  const removeEventListener = () => {
    try {
      scope.removeEventListener(type, listener, options);
    } catch {}
    for (const remove of children) {
      remove();
    }
  };

  return removeEventListener;
}

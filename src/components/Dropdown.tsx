/** Custom select: a trigger button plus a portal-rendered listbox, so menus
 *  float above scrollable panels instead of using the OS-native picker.
 *  Full keyboard support (arrows / Home / End / Enter / Escape), click-outside
 *  and scroll-away dismissal, and automatic flip when short on space. */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "./Icons";

export interface DropdownOption {
  value: string;
  label: string;
  /** Optional mono annotation on the right edge of the row (e.g. `p.12`). */
  hint?: string;
}

const MENU_MAX_HEIGHT = 300;
const MENU_GAP = 5;

export function Dropdown(props: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** `field` looks like an input; `ghost` is quiet chrome (panel footer). */
  variant?: "field" | "ghost";
  /** Which trigger edge the menu aligns to. */
  align?: "left" | "right";
  ariaLabel?: string;
  className?: string;
}) {
  const { value, options, onChange, align = "left" } = props;
  const variant = props.variant ?? "field";
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [drop, setDrop] = useState<"down" | "up">("down");

  const selected = options.find((o) => o.value === value);

  const openMenu = useCallback(() => {
    const idx = options.findIndex((o) => o.value === value);
    setHi(idx >= 0 ? idx : 0);
    setOpen(true);
  }, [options, value]);

  const close = useCallback(() => setOpen(false), []);

  // Position the menu against the trigger once it exists, flipping upward
  // when the space below can't fit it but the space above can.
  useLayoutEffect(() => {
    if (!open) return;
    const btn = btnRef.current;
    const menu = menuRef.current;
    if (!btn || !menu) return;
    const r = btn.getBoundingClientRect();
    const menuH = Math.min(menu.scrollHeight + 2, MENU_MAX_HEIGHT);
    const below = window.innerHeight - r.bottom - MENU_GAP - 8;
    const above = r.top - MENU_GAP - 8;
    const up = below < menuH && above > below;
    setDrop(up ? "up" : "down");
    const style: CSSProperties = {
      minWidth: Math.max(r.width, 168),
      maxWidth: Math.min(360, window.innerWidth - 16),
      maxHeight: Math.min(MENU_MAX_HEIGHT, up ? above : below),
    };
    if (align === "right") style.right = Math.max(8, window.innerWidth - r.right);
    else style.left = Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8));
    if (up) style.bottom = window.innerHeight - r.top + MENU_GAP;
    else style.top = r.bottom + MENU_GAP;
    setMenuStyle(style);
  }, [open, align]);

  // Dismiss on outside pointer, scroll elsewhere, resize, or window blur.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    };
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [open, close]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector(`[data-index="${hi}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, hi]);

  const pick = (index: number) => {
    const opt = options[index];
    if (opt) onChange(opt.value);
    close();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHi((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHi((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setHi(0);
        break;
      case "End":
        e.preventDefault();
        setHi(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(hi);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close();
        break;
    }
  };

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className={`dd-trigger ${variant} ${open ? "open" : ""} ${props.className ?? ""}`}
        disabled={props.disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={props.ariaLabel}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="dd-value">{selected?.label ?? "—"}</span>
        <ChevronDown className="dd-caret" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={`dd-menu ${drop}`}
            style={menuStyle}
            role="listbox"
            aria-label={props.ariaLabel}
          >
            {options.map((o, i) => (
              <div
                key={o.value}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                className={`dd-option ${i === hi ? "hi" : ""} ${o.value === value ? "sel" : ""}`}
                onMouseEnter={() => setHi(i)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
              >
                <span className="dd-label">{o.label}</span>
                {o.hint && <span className="dd-hint">{o.hint}</span>}
                <span className="dd-check">{o.value === value && <Check />}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

export interface AddressSuggestion {
  street: string;
  label: string;
  city: string;
  zip: string;
}

interface AddressAutocompleteProps {
  /** Ref forwarded to the underlying input (for form reads) */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  id?: string;
  name?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** Called when user selects a suggestion — parent should fill city + ZIP */
  onSelect?: (suggestion: AddressSuggestion) => void;
}

/**
 * Street address input with Mapy.com autocomplete suggestions.
 * Debounces 250ms, fetches from /api/suggest (server-side proxy).
 * Auto-fills city + ZIP on selection via onSelect callback.
 */
export function AddressAutocomplete({
  inputRef,
  onSelect,
  ...inputProps
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Track whether user just selected a suggestion to suppress re-fetching
  const justSelectedRef = useRef(false);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/suggest?q=${encodeURIComponent(query)}`,
      );
      if (!res.ok) {
        setSuggestions([]);
        return;
      }
      const data = await res.json();
      const items: AddressSuggestion[] = data.items ?? [];
      setSuggestions(items);
      setIsOpen(items.length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      // Skip fetch if user just selected (avoids refetching for the filled value)
      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, 250);
    },
    [fetchSuggestions],
  );

  const selectSuggestion = useCallback(
    (suggestion: AddressSuggestion) => {
      justSelectedRef.current = true;
      // Set input value to selected street
      if (inputRef?.current) {
        // Use native setter to trigger React's onChange tracking
        const nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        nativeSetter?.call(inputRef.current, suggestion.street);
        inputRef.current.dispatchEvent(
          new Event("input", { bubbles: true }),
        );
      }
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      onSelect?.(suggestion);
    },
    [inputRef, onSelect],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1,
          );
          break;
        case "Enter":
          if (activeIndex >= 0 && activeIndex < suggestions.length) {
            e.preventDefault();
            selectSuggestion(suggestions[activeIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setActiveIndex(-1);
          break;
      }
    },
    [isOpen, suggestions, activeIndex, selectSuggestion],
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        {...inputProps}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={isOpen ? "address-suggestions" : undefined}
        aria-activedescendant={
          activeIndex >= 0 ? `address-suggestion-${activeIndex}` : undefined
        }
      />

      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listRef}
          id="address-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border bg-popover shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.street}-${suggestion.zip}`}
              id={`address-suggestion-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`flex cursor-pointer items-start gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                index === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
              onMouseDown={(e) => {
                // mousedown instead of click to fire before input blur
                e.preventDefault();
                selectSuggestion(suggestion);
              }}
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="font-medium leading-tight">
                  {suggestion.street}
                </p>
                <p className="text-xs text-muted-foreground">
                  {suggestion.zip} {suggestion.city}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

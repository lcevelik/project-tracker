"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, ChevronDown, Plus, Tag } from "lucide-react";

interface GroupPickerProps {
  value: string | null;
  groups: string[];
  onChange: (group: string | null) => void;
  placeholder?: string;
}

export function GroupPicker({
  value,
  groups,
  onChange,
  placeholder = "Enter group name...",
}: GroupPickerProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value ?? "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value ?? "");
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredGroups = groups.filter(
    (g) =>
      g.toLowerCase().includes(inputValue.toLowerCase()) && g !== value
  );

  function handleSelect(group: string) {
    setInputValue(group);
    onChange(group);
    setOpen(false);
  }

  function handleCreate() {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onChange(trimmed);
      setOpen(false);
    }
  }

  function handleRemove() {
    setInputValue("");
    onChange(null);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              onChange(e.target.value.trim() || null);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pl-8 border-zinc-800 bg-zinc-950 text-zinc-200"
          />
          {inputValue && (
            <button
              onClick={handleRemove}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {open && (filteredGroups.length > 0 || inputValue.trim()) && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 shadow-lg">
          <div className="max-h-48 overflow-y-auto p-1">
            {/* Existing groups */}
            {filteredGroups.map((group) => (
              <button
                key={group}
                onClick={() => handleSelect(group)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                <Tag className="h-3.5 w-3.5 text-zinc-500" />
                {group}
              </button>
            ))}

            {/* Create new group option */}
            {inputValue.trim() &&
              !groups.some(
                (g) => g.toLowerCase() === inputValue.trim().toLowerCase()
              ) && (
                <button
                  onClick={handleCreate}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-emerald-400 hover:bg-zinc-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create &quot;{inputValue.trim()}&quot;
                </button>
              )}

            {/* Remove from group option */}
            {value && (
              <button
                onClick={handleRemove}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
                Remove from group
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

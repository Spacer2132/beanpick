"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const cupNotes = [
  "All",
  "Floral",
  "Berry",
  "Chocolate",
  "Nuts",
  "Citrus",
  "Caramel",
  "Honey",
  "Fruity",
  "Spicy",
  "Earthy",
];

export function FilterChips() {
  const [selected, setSelected] = useState<string[]>(["All"]);

  const toggleFilter = (note: string) => {
    if (note === "All") {
      setSelected(["All"]);
      return;
    }

    setSelected((prev) => {
      const newSelected = prev.filter((n) => n !== "All");
      if (newSelected.includes(note)) {
        const filtered = newSelected.filter((n) => n !== note);
        return filtered.length === 0 ? ["All"] : filtered;
      }
      return [...newSelected, note];
    });
  };

  return (
    <div className="overflow-x-auto hide-scrollbar -mx-5 px-5">
      <div className="flex gap-2 pb-1">
        {cupNotes.map((note) => {
          const isSelected = selected.includes(note);
          return (
            <button
              key={note}
              onClick={() => toggleFilter(note)}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                "border border-border",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground hover:bg-secondary"
              )}
            >
              {note}
            </button>
          );
        })}
      </div>
    </div>
  );
}

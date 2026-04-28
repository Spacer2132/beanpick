"use client";

import { Coffee } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          <Coffee className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
          Roast
        </span>
      </div>
      <button className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
          <span className="text-xs font-medium text-accent-foreground">JD</span>
        </div>
      </button>
    </header>
  );
}

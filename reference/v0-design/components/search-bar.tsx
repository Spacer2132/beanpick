"use client";

import { Search } from "lucide-react";

export function SearchBar() {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-muted-foreground" />
      </div>
      <input
        type="text"
        placeholder="Search beans, origins, notes..."
        className="w-full bg-secondary border-0 rounded-full py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
      />
    </div>
  );
}

import { Search } from "iconoir-react";

import { Input } from "@/components/ui/input";

export function SearchInput({
  placeholder = "Search",
  value,
  onChange,
}: {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.8}
      />
      <Input
        className="h-10 pl-9"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
      />
    </div>
  );
}

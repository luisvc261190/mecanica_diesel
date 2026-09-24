import * as React from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export function SearchInput({
  value: controlled,
  onValueChange,
  debounceMs = 300,
  className,
  ...props
}: SearchInputProps) {
  const [internal, setInternal] = React.useState(controlled ?? "");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isControlled = controlled !== undefined;

  React.useEffect(() => {
    if (isControlled) setInternal(controlled);
  }, [isControlled, controlled]);

  React.useEffect(() => {
    if (!onValueChange) return;
    const handler = window.setTimeout(() => onValueChange(internal.trim()), debounceMs);
    return () => window.clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internal, debounceMs]);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={internal}
        onChange={(e) => setInternal(e.target.value)}
        className="pl-8 pr-8"
        aria-label="Buscar"
        {...props}
      />
      {internal ? (
        <button
          type="button"
          onClick={() => {
            setInternal("");
            onValueChange?.("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
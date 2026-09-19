import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RANGE_OPTIONS, type RangePreset } from "@/lib/date-range";

/** Filtro de período partilhado pelo analítico geral e pelas métricas de cada webinar. */
export function DateRangeFilter({
  preset,
  onPresetChange,
  from,
  to,
  onFromChange,
  onToChange,
  className,
}: {
  preset: RangePreset;
  onPresetChange: (value: RangePreset) => void;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="min-w-[180px]">
        <Label className="text-xs text-muted-foreground">Período</Label>
        <Select value={preset} onValueChange={(value) => onPresetChange(value as RangePreset)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {preset === "personalizado" ? (
        <>
          <div>
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              type="date"
              className="mt-1"
              value={from}
              onChange={(event) => onFromChange(event.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              type="date"
              className="mt-1"
              value={to}
              onChange={(event) => onToChange(event.target.value)}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

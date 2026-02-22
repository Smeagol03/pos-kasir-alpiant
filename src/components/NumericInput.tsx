import * as React from "react";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
}

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, className, prefix, suffix, ...props }, ref) => {
    // Format number to string with dots as thousand separators
    const formatDisplay = (val: number): string => {
      if (val === 0) return "0";
      return new Intl.NumberFormat("id-ID").format(val);
    };

    const [displayValue, setDisplayValue] = React.useState(formatDisplay(value));

    // Update display value when prop value changes externally
    React.useEffect(() => {
      setDisplayValue(formatDisplay(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/\D/g, ""); // Remove non-digits
      
      // Handle leading zero: if it was 0 and we type a number, replace the 0
      const numericValue = rawValue === "" ? 0 : parseInt(rawValue, 10);
      
      setDisplayValue(formatDisplay(numericValue));
      onChange(numericValue);
    };

    return (
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-muted-foreground text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="numeric"
          className={cn(
            className,
            prefix && "pl-10",
            suffix && "pr-10",
            "font-mono text-right"
          )}
          value={displayValue}
          onChange={handleChange}
          onFocus={() => {
            if (value === 0) setDisplayValue(""); // Clear 0 on focus for easier typing
          }}
          onBlur={() => {
            setDisplayValue(formatDisplay(value)); // Restore format on blur
          }}
        />
        {suffix && (
          <span className="absolute right-3 text-muted-foreground text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);

NumericInput.displayName = "NumericInput";

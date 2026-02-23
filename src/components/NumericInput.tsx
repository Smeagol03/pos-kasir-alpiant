import * as React from "react";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  allowNegative?: boolean;
}

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, className, prefix, suffix, allowNegative = false, ...props }, ref) => {
    // Format number to string with dots as thousand separators
    const formatDisplay = (val: number): string => {
      if (val === 0) return "0";
      return new Intl.NumberFormat("id-ID").format(val);
    };

    const [displayValue, setDisplayValue] = React.useState(formatDisplay(value));

    // Update display value when prop value changes externally
    React.useEffect(() => {
      // Don't update if we are in the middle of typing a negative sign
      if (displayValue === "-" && value === 0) return;
      setDisplayValue(formatDisplay(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      
      // Check if it's negative (only if allowed and starts with -)
      const isNegative = allowNegative && val.startsWith("-");
      
      // Remove all non-digits
      const digits = val.replace(/\D/g, "");
      
      // Handle the case where only "-" is typed
      if (val === "-" && allowNegative) {
        setDisplayValue("-");
        onChange(0);
        return;
      }

      // Handle leading zero or empty
      const numericValue = digits === "" ? 0 : parseInt(digits, 10);
      const finalValue = isNegative ? -numericValue : numericValue;
      
      setDisplayValue(formatDisplay(finalValue));
      onChange(finalValue);
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
          inputMode={allowNegative ? "text" : "numeric"}
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

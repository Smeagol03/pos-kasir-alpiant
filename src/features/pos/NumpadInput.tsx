import { Button } from "../../components/ui/button";

interface NumpadInputProps {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
}

export function NumpadInput({ value, onChange, onEnter }: NumpadInputProps) {
  const handleKeyClick = (key: string) => {
    if (key === "clear") {
      onChange("0");
    } else if (key === "backspace") {
      onChange(value.length > 1 ? value.slice(0, -1) : "0");
    } else if (key === "enter") {
      if (onEnter) onEnter();
    } else {
      onChange(value === "0" ? key : value + key);
    }
  };

  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["clear", "0", "backspace"],
  ];

  const presets = [10000, 20000, 50000, 100000];

  const handlePreset = (amount: number) => {
    const current = Number(value) || 0;
    onChange((current + amount).toString());
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {presets.map((p) => (
          <Button
            key={p}
            variant="outline"
            className="text-xs bg-muted/50"
            onClick={() => handlePreset(p)}
          >
            +{p / 1000}k
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {keys.map((row, i) =>
          row.map((key) => (
            <Button
              key={`${i}-${key}`}
              variant="outline"
              className="h-14 text-xl font-medium shadow-sm hover:border-primary"
              onClick={() => handleKeyClick(key)}
            >
              {key === "clear" ? "C" : key === "backspace" ? "⌫" : key}
            </Button>
          )),
        )}
      </div>
      {onEnter && (
        <Button
          className="w-full h-14 text-lg font-bold"
          onClick={() => handleKeyClick("enter")}
        >
          Enter
        </Button>
      )}
    </div>
  );
}

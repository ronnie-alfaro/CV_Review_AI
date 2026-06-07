import type { TextareaHTMLAttributes } from "react";

type FieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

export function Field({ label, ...props }: FieldProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      {label}
      <textarea
        className="min-h-24 resize-y rounded-md border border-input bg-white px-3 py-2 text-sm font-normal leading-6 outline-none focus:ring-2 focus:ring-ring"
        {...props}
      />
    </label>
  );
}

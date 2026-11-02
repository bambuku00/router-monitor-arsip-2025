import { cn } from "@/lib/utils";
import { INPUT_BASE, SELECT_BASE } from "@/lib/input-styles";
import React from "react";
import CurrencyInput, { CurrencyInputProps } from "react-currency-input-field";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { useDropzone } from "react-dropzone";
import { MdDelete } from "react-icons/md";

type InputProps = {
  className?: string;
} & React.ComponentProps<"input">;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        spellCheck="false"
        className={cn(INPUT_BASE, props.type === "date" && "h-fit self-end", className)}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

type InputPhoneProps = {
  className?: string;
  value: string;
  onChange: (value: string) => void;
} & React.ComponentProps<"input">;

export const InputPhone = React.memo(
  React.forwardRef<HTMLInputElement, InputPhoneProps>(
    ({ className, onChange, value, ...props }, ref) => {
      const [displayValue, setDisplayValue] = React.useState(value);
      React.useEffect(() => {
        const phoneNumber = parsePhoneNumberFromString(value || "", "ID");
        const formattedDisplayValue = phoneNumber
          ? phoneNumber.formatInternational()
          : value;
        setDisplayValue(formattedDisplayValue);
      }, [value]);

      const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value || "";
        const phoneNumber = parsePhoneNumberFromString(inputValue, "ID");
        const formattedDisplayValue = phoneNumber
          ? phoneNumber.formatInternational()
          : inputValue;
        const formattedRecordedValue = phoneNumber
          ? phoneNumber.formatInternational().replace(/\s+/g, "")
          : inputValue.replace(/\s+/g, "");

        setDisplayValue(formattedDisplayValue);
        onChange(formattedRecordedValue);
      };

      return (
        <input
          ref={ref}
          type="tel"
          value={displayValue}
          onChange={handleInputChange}
          placeholder="+62"
          className={cn(INPUT_BASE, className)}
          {...props}
        />
      );
    }
  )
);
InputPhone.displayName = "InputPhone";

export const InputIDR = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, ...props }, ref) => {
    return (
      <CurrencyInput
        ref={ref}
        spellCheck="false"
        className={cn(INPUT_BASE, className)}
        id="idr-input"
        value={value}
        placeholder="Rp"
        decimalsLimit={2}
        groupSeparator="."
        decimalSeparator=","
        prefix="Rp "
        {...props}
      />
    );
  }
);
InputIDR.displayName = "InputIDR";

type InputDateProps = {
  className?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
} & Omit<React.ComponentProps<"input">, "onChange" | "value">;

export const InputDate = React.memo(
  React.forwardRef<HTMLInputElement, InputDateProps>(
    ({ className, onChange, value, placeholder = "DD/MM/YYYY", ...props }, ref) => {
      // Initialize display value from YYYY-MM-DD to DD/MM/YYYY
      const formatToDisplay = (dateStr: string) => {
        if (!dateStr) return "";
        const parts = dateStr.split("-");
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      };

      const [displayValue, setDisplayValue] = React.useState(
        formatToDisplay(value)
      );

      // Sync if external value changes (and is different from current internal state representation)
      React.useEffect(() => {
        // Only update if the parsed value of current display doesn't match new value
        // This avoids cursor jumping issues if we were to format on every keystroke too aggressively
        // But since we format YYYY-MM-DD -> DD/MM/YYYY, let's just sync it.
        if (value) {
            setDisplayValue(formatToDisplay(value));
        }
      }, [value]);

      const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        
        // Allow only numbers and slashes
        val = val.replace(/[^0-9/]/g, "");
        
        // Auto-insert slashes
        if (val.length === 2 && displayValue.length === 1) val += "/";
        if (val.length === 5 && displayValue.length === 4) val += "/";
        
        // Prevent more than 10 chars (DD/MM/YYYY)
        if (val.length > 10) val = val.slice(0, 10);

        setDisplayValue(val);

        // Validate and emit change if complete
        if (val.length === 10) {
          const parts = val.split("/");
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parseInt(parts[2]);
            
            // Basic validation
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year > 1900) {
               // Pad with zeros if needed (though logic above implies 2 digits)
               const yyyy = parts[2];
               const mm = parts[1].padStart(2, "0");
               const dd = parts[0].padStart(2, "0");
               onChange(`${yyyy}-${mm}-${dd}`);
            }
          }
        }
      };

      return (
        <input
          ref={ref}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={cn(INPUT_BASE, className)}
          maxLength={10}
          {...props}
        />
      );
    }
  )
);
InputDate.displayName = "InputDate";

type InputMonthProps = {
  className?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
} & Omit<React.ComponentProps<"input">, "onChange" | "value">;

export const InputMonth = React.memo(
  React.forwardRef<HTMLInputElement, InputMonthProps>(
    ({ className, onChange, value, placeholder = "MM/YYYY", ...props }, ref) => {
      const formatToDisplay = (dateStr: string) => {
        if (!dateStr) return "";
        const parts = dateStr.split("-");
        if (parts.length !== 2) return dateStr;
        return `${parts[1]}/${parts[0]}`;
      };

      const [displayValue, setDisplayValue] = React.useState(
        formatToDisplay(value)
      );

      React.useEffect(() => {
        if (value) {
          setDisplayValue(formatToDisplay(value));
        }
      }, [value]);

      const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/[^0-9/]/g, "");
        if (val.length === 2 && displayValue.length === 1) val += "/";
        if (val.length > 7) val = val.slice(0, 7);
        setDisplayValue(val);

        if (val.length === 7) {
          const parts = val.split("/");
          if (parts.length === 2) {
            const [mm, yyyy] = parts;
            if (mm >= "01" && mm <= "12" && yyyy > "1900") {
              onChange(`${yyyy}-${mm.padStart(2, "0")}`);
            }
          }
        }
      };

      return (
        <input
          ref={ref}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={cn(INPUT_BASE, className)}
          maxLength={7}
          {...props}
        />
      );
    }
  )
);
InputMonth.displayName = "InputMonth";

const MONTH_LABELS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

type SelectMonthProps = {
  className?: string;
  value: string;
  onChange: (value: string) => void;
  /** Jika diisi, hanya kombinasi YYYY-MM ini yang bisa dipilih. */
  allowedMonths?: readonly string[];
  yearClassName?: string;
} & Omit<React.ComponentProps<"div">, "onChange" | "value">;

export const SelectMonth = React.memo(
  React.forwardRef<HTMLDivElement, SelectMonthProps>(
    ({ className, onChange, value, allowedMonths, yearClassName, ...props }, ref) => {
      const date = new Date();
      const currentYear = date.getFullYear();
      const allowed = allowedMonths?.filter((item) => /^\d{4}-\d{2}$/.test(item));
      const years = allowed?.length
        ? [...new Set(allowed.map((item) => Number(item.slice(0, 4))))].sort(
            (a, b) => b - a
          )
        : Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

      const [y, m] = (value || "").split("-");
      const selectedYear = y || String(years[0] ?? currentYear);
      const monthChoices = MONTH_LABELS.map((label, index) => ({
        label,
        value: String(index + 1).padStart(2, "0"),
      })).filter((month) =>
        allowed?.length
          ? allowed.includes(`${selectedYear}-${month.value}`)
          : true
      );

      const commit = (year: string, month: string) => {
        const next = `${year}-${month}`;
        if (!allowed?.length || allowed.includes(next)) {
          onChange(next);
          return;
        }
        const inYear = allowed.find((item) => item.startsWith(`${year}-`));
        onChange(inYear ?? allowed[0]);
      };

      const handleChange = (type: "month" | "year", val: string) => {
        const newY = type === "year" ? val : y || String(currentYear);
        const newM =
          type === "month"
            ? val
            : m || String(date.getMonth() + 1).padStart(2, "0");
        commit(newY, newM);
      };

      return (
        <div ref={ref} className={cn("flex gap-2", className)} {...props}>
          <select
            value={m}
            onChange={(e) => handleChange("month", e.target.value)}
            className={SELECT_BASE}
          >
            <option value="" disabled>
              Bulan
            </option>
            {monthChoices.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
          <select
            value={y}
            onChange={(e) => handleChange("year", e.target.value)}
            className={cn(
              SELECT_BASE,
              "min-w-[5rem] shrink-0 tabular-nums",
              yearClassName
            )}
          >
            <option value="" disabled>
              Tahun
            </option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      );
    }
  )
);
SelectMonth.displayName = "SelectMonth";

type SelectDateProps = {
  className?: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<"div">, "onChange" | "value">;

export const SelectDate = React.memo(
  React.forwardRef<HTMLDivElement, SelectDateProps>(
    ({ className, onChange, value, ...props }, ref) => {
      const date = new Date();
      const currentYear = date.getFullYear();
      const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
      const months = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];

      const [y, m, d] = (value || "").split("-");

      // Calculate days in month
      const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month, 0).getDate();
      };

      const daysInMonth =
        y && m ? getDaysInMonth(parseInt(y), parseInt(m)) : 31;
      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

      const handleChange = (type: "day" | "month" | "year", val: string) => {
        let newY = y || String(currentYear);
        let newM = m || String(date.getMonth() + 1).padStart(2, "0");
        let newD = d || String(date.getDate()).padStart(2, "0");

        if (type === "year") newY = val;
        if (type === "month") newM = val;
        if (type === "day") newD = val;

        // Validate day if month changes and day is out of range
        const maxDay = getDaysInMonth(parseInt(newY), parseInt(newM));
        if (parseInt(newD) > maxDay) newD = String(maxDay).padStart(2, "0");

        onChange(`${newY}-${newM}-${newD}`);
      };

      return (
        <div ref={ref} className={cn("flex gap-2", className)} {...props}>
          <select
            value={d}
            onChange={(e) => handleChange("day", e.target.value)}
            className={cn(SELECT_BASE, "w-fit")}
          >
            <option value="" disabled>
              Tgl
            </option>
            {days.map((day) => (
              <option key={day} value={String(day).padStart(2, "0")}>
                {day}
              </option>
            ))}
          </select>
          <select
            value={m}
            onChange={(e) => handleChange("month", e.target.value)}
            className={SELECT_BASE}
          >
            <option value="" disabled>
              Bulan
            </option>
            {months.map((month, i) => (
              <option key={month} value={String(i + 1).padStart(2, "0")}>
                {month}
              </option>
            ))}
          </select>
          <select
            value={y}
            onChange={(e) => handleChange("year", e.target.value)}
            className={cn(SELECT_BASE, "w-fit")}
          >
            <option value="" disabled>
              Tahun
            </option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      );
    }
  )
);
SelectDate.displayName = "SelectDate";

type SelectDayProps = {
  className?: string;
  value: number | null | undefined;
  onChange: (value: number) => void;
} & Omit<React.ComponentProps<"div">, "onChange" | "value">;

export const SelectDay = React.memo(
  React.forwardRef<HTMLDivElement, SelectDayProps>(
    ({ className, onChange, value, ...props }, ref) => {
      const days = Array.from({ length: 31 }, (_, i) => i + 1);

      return (
        <div ref={ref} className={cn("flex gap-2", className)} {...props}>
          <select
            value={value || ""}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className={SELECT_BASE}
          >
            <option value="" disabled>
              Tgl
            </option>
            {days.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
      );
    }
  )
);
SelectDay.displayName = "SelectDay";

type InputRadioCheckboxProps = {
  wrapperClassName?: string;
  labelClassName?: string;
  label: string;
  type: "checkbox" | "radio";
  wrapperOnClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
} & React.ComponentProps<"input">;
export const InputRadioCheckbox = React.forwardRef<
  HTMLInputElement,
  InputRadioCheckboxProps
>(
  (
    {
      className,
      wrapperClassName,
      labelClassName,
      checked,
      disabled,
      id,
      label,
      onChange,
      wrapperOnClick,
      type,
      ...props
    },
    ref
  ) => {
    const handleWrapperClick = (
      e: React.MouseEvent<HTMLDivElement, MouseEvent>
    ) => {
      e.stopPropagation();
      if (wrapperOnClick) {
        wrapperOnClick(e);
      }
      if (onChange) {
        const event = {
          ...e,
          target: { ...e.target, type, checked: !checked, name: props.name },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
      }
    };

    const handleLabelClick = (
      e: React.MouseEvent<HTMLLabelElement, MouseEvent>
    ) => {
      e.preventDefault();
      if (type === "checkbox" && onChange) {
        const event = {
          ...e,
          target: { ...e.target, type, checked: !checked, name: props.name },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
      }
    };

    return (
      <div
        className={cn(
          "flex gap-1.5 items-center cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-theme-muted *:cursor-pointer",
          wrapperClassName
        )}
        onClick={handleWrapperClick}
      >
        <input
          type={type}
          ref={ref}
          disabled={disabled}
          className={cn("size-5 accent-green-600", className)}
          checked={checked}
          id={id}
          onChange={onChange}
          {...props}
        />
        <label
          htmlFor={id}
          onClick={handleLabelClick}
          className={cn(labelClassName)}
        >
          {label}
        </label>
      </div>
    );
  }
);
InputRadioCheckbox.displayName = "InputRadioCheckbox";

type InputDropzoneFileProps = {
  field: {
    value: File | string | null | undefined;
    onChange: (value: File | string | null | undefined) => void;
    onBlur: () => void;
  };
  className?: string;
  placeholder?: string;
};
export const InputDropzoneFile = React.forwardRef<
  HTMLInputElement,
  InputDropzoneFileProps
>(({ className, field, placeholder }, ref) => {
  const [file, setFile] = React.useState<File | null>(
    field.value instanceof File ? field.value : null
  );

  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        field.onChange(acceptedFiles[0]);
      }
    },
    [field]
  );

  const handleDelete = () => {
    setFile(null);
    field.onChange(null);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { "image/*": [] },
  });

  React.useEffect(() => {
    setFile(field.value instanceof File ? field.value : null);
  }, [field.value]);

  return (
    <div className="relative">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed relative rounded-xl p-5 text-sm text-center select-none cursor-pointer bg-slate-200/80 dark:bg-theme-elevated dark:text-theme-fg active:border-sky-500",
          isDragActive ? "border-sky-500" : "border-gray-300 dark:border-theme-border",
          className
        )}
      >
        <input {...getInputProps()} ref={ref} />
        {file ? (
          <p>{file.name}</p>
        ) : !placeholder && isDragActive ? (
          <p>Drop the file here...</p>
        ) : !placeholder ? (
          <p>Drag &apos;n&apos; drop the file here, or click to select file</p>
        ) : (
          <p>{placeholder}</p>
        )}
      </div>
      {file ? (
        <button
          type="button"
          className="absolute -right-1 -top-1 rounded-full bg-red-500 text-white p-1"
          onClick={handleDelete}
        >
          <MdDelete className="size-3" />
        </button>
      ) : null}
    </div>
  );
});

InputDropzoneFile.displayName = "InputDropzoneFile";

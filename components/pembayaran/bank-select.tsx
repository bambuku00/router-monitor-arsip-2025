"use client";

import { cn } from "@/lib/utils";
import type { Bank } from "@prisma/client";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { FaChevronDown } from "react-icons/fa";
import { FaCheck } from "react-icons/fa6";

type Props = {
  banks: Bank[];
  value: number | null | undefined;
  onChange: (bankId: number | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  buttonClassName?: string;
  optionsClassName?: string;
};

export default function BankSelect({
  banks,
  value,
  onChange,
  disabled,
  placeholder = "Pilih rekening bank",
  buttonClassName,
  optionsClassName,
}: Props) {
  const selected = banks.find((b) => b.id === value) ?? null;

  return (
    <Listbox
      value={selected}
      onChange={(b) => onChange(b?.id)}
      disabled={disabled}
    >
      <div className="relative">
        <ListboxButton
          className={cn(
            "relative w-full cursor-pointer rounded-lg border-none bg-slate-200/80 py-1.5 pr-8 pl-3 text-left text-sm/6",
            "focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/25",
            disabled && "cursor-default opacity-70",
            buttonClassName
          )}
        >
          <span className="block truncate">
            {selected
              ? `${selected.bank} - ${selected.norek} ${selected.nama}`
              : placeholder}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
            <FaChevronDown className="size-4 fill-gray-900/60" aria-hidden />
          </span>
        </ListboxButton>
        <ListboxOptions
          anchor="bottom"
          transition
          className={cn(
            "z-[1002] w-[var(--button-width)] rounded-xl border border-slate-300/80 bg-slate-200 p-1 [--anchor-gap:var(--spacing-1)]",
            optionsClassName,
            "transition duration-100 ease-in data-[closed]:opacity-0 focus:outline-none empty:invisible"
          )}
        >
          {banks.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">
              Belum ada rekening bank
            </p>
          ) : (
            banks.map((b) => (
              <ListboxOption
                key={b.id}
                value={b}
                className="group flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-1.5 select-none data-[focus]:bg-slate-100"
              >
                <div className="min-w-0">
                  <p className="text-sm/6 text-gray-900">{b.bank}</p>
                  <p className="text-sm/7 text-gray-900 truncate">
                    {`${b.norek} - ${b.nama}`}
                  </p>
                </div>
                <FaCheck className="invisible size-4 shrink-0 fill-green-600 group-data-[selected]:visible" />
              </ListboxOption>
            ))
          )}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

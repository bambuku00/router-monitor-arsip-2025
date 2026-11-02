"use client";

import { ClickAwayListener, Zoom } from "@mui/material";
import Tooltip, { tooltipClasses, TooltipProps } from "@mui/material/Tooltip";
import React, { useState } from "react";

export default function TooltipButton({
  children,
  ...props
}: {
  children: React.ReactElement;
} & TooltipProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });

  const handleTooltipClose = () => {
    setOpen(false);
  };

  const handleTooltipOpen = (event: React.MouseEvent<HTMLElement>) => {
    setCursorPosition({ top: event.clientY, left: event.clientX });
    setAnchorEl(event.currentTarget);
    setOpen(true);
  };

  return (
    <ClickAwayListener onClickAway={handleTooltipClose}>
      <Tooltip
        open={open}
        onClose={handleTooltipClose}
        disableFocusListener
        disableHoverListener
        disableTouchListener
        TransitionComponent={Zoom}
        placement="top-start"
        className="cursor-pointer"
        PopperProps={{
          modifiers: [
            {
              name: "offset",
              options: {
                offset: [
                  cursorPosition.left -
                    (anchorEl?.getBoundingClientRect().left || 0) -
                    28,
                  0,
                ],
              },
            },
          ],
        }}
        slotProps={{
          tooltip: {
            className:
              "grid text-sm/5 bg-slate-200 font-medium gap-0.5 rounded text-slate-700 p-1 shadow",
          },
          popper: {
            sx: {
              [`&.${tooltipClasses.popper}[data-popper-placement*="top"] .${tooltipClasses.tooltip}`]:
                {
                  marginBottom: "2px",
                },
            },
          },
        }}
        {...props}
      >
        {React.cloneElement(children, {
          onClick: open ? handleTooltipClose : handleTooltipOpen,
        })}
      </Tooltip>
    </ClickAwayListener>
  );
}

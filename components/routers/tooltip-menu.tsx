"use client";

import { ClickAwayListener, Zoom } from "@mui/material";
import Tooltip, { tooltipClasses } from "@mui/material/Tooltip";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { FiMenu } from "react-icons/fi";
import { HiBanknotes } from "react-icons/hi2";
import { MdBroadcastOnPersonal } from "react-icons/md";
import IsolirSetupDialog from "@/components/router/isolir-setup-dialog";
import { TbHeartRateMonitor, TbSettingsAutomation, TbTrash } from "react-icons/tb";
import { Button } from "../button";
import {
  fetchDeleteRouter,
  routerDeleteConfirmText,
} from "./router-delete-shared";
import type { SafeRouterRow } from "./data";

export default function TooltipMenu({
  router,
  superAdmin = false,
  canDeleteRouter = false,
  canManageIsolir = false,
}: {
  router: SafeRouterRow;
  superAdmin?: boolean;
  canDeleteRouter?: boolean;
  canManageIsolir?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const [isolirOpen, setIsolirOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { refresh } = useRouter();

  const handleTooltipClose = () => {
    setOpen(false);
  };

  const handleTooltipOpen = () => {
    setOpen(true);
  };

  const handleDeleteRouter = async () => {
    handleTooltipClose();
    const ok = window.confirm(routerDeleteConfirmText(router.nama));
    if (!ok) return;

    setDeleting(true);
    const toastLoad = toast.loading("Menghapus router...");
    try {
      const message = await fetchDeleteRouter(router.id);
      toast.success(message, { id: toastLoad });
      refresh();
    } catch (err) {
      toast.error((err as Error).message, { id: toastLoad });
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenIsolir = () => {
    handleTooltipClose();
    window.setTimeout(() => setIsolirOpen(true), 0);
  };

  return (
    <ClickAwayListener onClickAway={handleTooltipClose}>
      <div>
        <Tooltip
          open={open}
          onClose={handleTooltipClose}
          disableFocusListener
          disableHoverListener
          disableTouchListener
          TransitionComponent={Zoom}
          placement="top"
          className="cursor-pointer"
          slotProps={{
            popper: {
              sx: {
                [`&.${tooltipClasses.popper}[data-popper-placement*="top"] .${tooltipClasses.tooltip}`]:
                  {
                    marginBottom: "5px",
                  },
              },
            },
            tooltip: {
              className:
                "grid text-sm/5 bg-slate-200 font-medium gap-0.5 rounded text-slate-700 p-1 shadow",
            },
          }}
          PopperProps={{
            disablePortal: true,
          }}
          title={
            <>
              <Link
                href={`/router/${router.id}`}
                className="hover:bg-slate-100 flex gap-2 items-center py-1 px-2 rounded cursor-pointer"
              >
                <TbHeartRateMonitor className="size-4" />
                <p>Traffic</p>
              </Link>
              <div className="h-px mx-1.5 bg-slate-400" />
              <Link
                href={`/router/${router.id}/ppp`}
                className="hover:bg-slate-100 flex gap-2 items-center py-1 px-2 rounded cursor-pointer"
              >
                <MdBroadcastOnPersonal className="size-4" />
                <p>PPPoE</p>
              </Link>
              {superAdmin && router.userId != null ? (
                <>
                  <div className="h-px mx-1.5 bg-slate-400" />
                  <Link
                    href={`/pembayaran/${router.userId}?query=${router.nama}`}
                    className="hover:bg-slate-100 flex gap-2 items-center py-1 px-2 rounded cursor-pointer"
                  >
                    <HiBanknotes className="size-4" />
                    <p>Pembayaran</p>
                  </Link>
                </>
              ) : null}
              {canManageIsolir ? (
                <>
                  <div className="h-px mx-1.5 bg-slate-400" />
                  <button
                    type="button"
                    className="hover:bg-slate-100 flex gap-2 items-center py-1 px-2 rounded cursor-pointer w-full text-left"
                    onClick={handleOpenIsolir}
                  >
                    <TbSettingsAutomation className="size-4 shrink-0" />
                    <p>Setup Isolir</p>
                  </button>
                </>
              ) : null}
              {canDeleteRouter ? (
                <>
                  <div className="h-px mx-1.5 bg-slate-400" />
                  <button
                    type="button"
                    disabled={deleting}
                    className="hover:bg-red-50 flex gap-2 items-center py-1 px-2 rounded cursor-pointer text-left w-full text-red-700 disabled:opacity-50"
                    onClick={() => void handleDeleteRouter()}
                  >
                    <TbTrash className="size-4 shrink-0" />
                    <span>Hapus router</span>
                  </button>
                </>
              ) : null}
            </>
          }
        >
          <Button
            color="slatesky"
            className="rounded"
            disabled={deleting}
            onClick={open ? handleTooltipClose : handleTooltipOpen}
          >
            <FiMenu />
          </Button>
        </Tooltip>
        {canManageIsolir ? (
          <IsolirSetupDialog
            router={{
              id: router.id,
              nama: router.nama,
              os_version: router.os_version,
            }}
            canManage
            hideTrigger
            open={isolirOpen}
            onOpenChange={setIsolirOpen}
          />
        ) : null}
      </div>
    </ClickAwayListener>
  );
}

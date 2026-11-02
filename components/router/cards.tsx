"use client";

import CardCPU from "@/components/router/card-cpu";
import CardMemory from "@/components/router/card-memory";
import CardStorage from "@/components/router/card-storage";
import { useEffect, useRef, useState } from "react";
import CardHealth from "./card-health";
import { checkRouter } from "@/lib/server-actions/router/actions";
import toast from "react-hot-toast";
import { SystemResource } from "@/lib/router-types";

export default function CardsRouter({ id }: { id: number | undefined }) {
  const [resource, setResource] = useState<SystemResource>();
  const resourceInFlight = useRef(false);
  const healthInFlight = useRef(false);

  const loadRes = async (signal?: AbortSignal) => {
    if (resourceInFlight.current) return;
    resourceInFlight.current = true;
    try {
      const resp = await fetch(`/api/router/resource/${id}`, { signal });
      const json = await resp.json();
      if (resp.status !== 200) throw new Error(json.message);
      if (json) setResource(json);
    } catch (err) {
      if (signal?.aborted) return;
    } finally {
      resourceInFlight.current = false;
    }
  };

  const [health, setHealth] = useState<{
    temperature: string;
    voltage: string;
  }>();
  const loadHealth = async (signal?: AbortSignal) => {
    if (healthInFlight.current) return;
    healthInFlight.current = true;
    try {
      const resp = await fetch(`/api/router/health/${id}`, { signal });
      const json = await resp.json();
      if (resp.status !== 200) throw new Error(json.message);
      if (json) setHealth(json);
    } catch (err) {
      if (signal?.aborted) return;
    } finally {
      healthInFlight.current = false;
    }
  };

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();

    const check = async () => {
      const res = await checkRouter(id);
      if (!res)
        toast.error("Router tidak merespon. Harap cek konfigurasi router");
    };

    check();
    loadRes(controller.signal);
    loadHealth(controller.signal);

    const dataInterval = setInterval(() => loadRes(controller.signal), 1000);
    const healthInterval = setInterval(() => loadHealth(controller.signal), 5000);

    return () => {
      clearInterval(dataInterval);
      clearInterval(healthInterval);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when id changes; loadRes/loadHealth use id from closure
  }, [id]);

  return (
    <section className="grid sm:grid-cols-4 gap-6 w-full">
      <CardCPU
        load={
          resource?.["cpu-load"] ? parseInt(resource?.["cpu-load"]) : undefined
        }
        count={
          resource?.["cpu-count"]
            ? parseInt(resource?.["cpu-count"])
            : undefined
        }
        frequency={
          resource?.["cpu-frequency"]
            ? parseInt(resource?.["cpu-frequency"])
            : undefined
        }
        uptime={resource?.uptime}
      />
      <CardMemory
        free={
          resource?.["free-memory"]
            ? parseInt(resource?.["free-memory"])
            : undefined
        }
        total={
          resource?.["total-memory"]
            ? parseInt(resource?.["total-memory"])
            : undefined
        }
        used={(() => {
          const val =
            parseInt(resource?.["total-memory"] as string) -
            parseInt(resource?.["free-memory"] as string);
          return val;
        })()}
      />
      <CardStorage
        free={
          resource?.["free-hdd-space"]
            ? parseInt(resource?.["free-hdd-space"])
            : undefined
        }
        total={
          resource?.["total-hdd-space"]
            ? parseInt(resource?.["total-hdd-space"])
            : undefined
        }
        used={(() => {
          const val =
            parseInt(resource?.["total-hdd-space"] as string) -
            parseInt(resource?.["free-hdd-space"] as string);
          return val;
        })()}
      />
      <CardHealth
        temp={health?.temperature ? parseFloat(health?.temperature) : undefined}
        volt={health?.voltage ? parseFloat(health?.voltage) : undefined}
        board={resource?.["board-name"]}
      />
    </section>
  );
}

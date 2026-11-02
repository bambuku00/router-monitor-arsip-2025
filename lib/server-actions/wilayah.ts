"use server";

import { TIME } from "@/lib/constants";
import Fuse from "fuse.js";
import { logger } from "@/lib/logger";
import prisma from "../prisma";
import { unstable_cache } from "next/cache";

const getKodepos = unstable_cache(
  async () => {
    return (
      (await prisma.kodepos.findMany({
        include: {
          regency: {
            include: {
              province: true,
            },
          },
        },
      })) || []
    );
  },
  ["kodepos"],
  {
    revalidate: TIME.SEVEN_DAYS_SEC,
  }
);

export async function getWilayah(query: string) {
  try {
    const kodepos = await getKodepos();

    const options = {
      keys: ["code", "regency.nama", "regency.province.nama"],
      threshold: 0.3,
    };

    const fuse = new Fuse(kodepos, options);
    const result = fuse.search(query);

    return result.slice(0, 5).map((res) => res.item);
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "getWilayah error", error: error.message });
    return [];
  }
}

import { Paket } from "@prisma/client";

export type EditState = {
  modal: boolean;
  data?: Paket;
};

export type EditAction =
  | { action: "open"; data: EditState["data"] }
  | { action: "close" }
  | { action: "data"; data: EditState["data"] };

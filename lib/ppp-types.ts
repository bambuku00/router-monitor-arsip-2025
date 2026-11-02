import { GetPPP } from "./server-actions/router/ppp/actions";
import { ArrayElementType } from "./utils";

export type EditState = {
  modal: boolean;
  data?: ArrayElementType<GetPPP["data"]>;
};

export type EditAction =
  | { action: "open"; data: EditState["data"] }
  | { action: "close" }
  | { action: "data"; data: EditState["data"] };

/** What a server action tells the page. Messages are written for the person using the page. */
export type ActionResult<Extra = object> =
  | ({ ok: true; message: string; warning?: string } & Extra)
  | { ok: false; message: string; field?: string }

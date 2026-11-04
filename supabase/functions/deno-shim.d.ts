// Type-check only (see tsconfig.json). Deno provides these at run time; this file is not deployed.
declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

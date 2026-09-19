//@ts-expect-error - global.io is assigned dynamically in server.ts, not declared on the global type
export const socket = global.io

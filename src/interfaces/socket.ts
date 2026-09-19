import { JwtPayload } from "jsonwebtoken";
import { Socket } from "socket.io";

export type SocketWithUser = {
    user?: JwtPayload & {
      authId: string
      name: string
      role: string
    }
  } & Socket


  // Standard error response format
export type ErrorResponse = {
    statusCode: number
    error: string
    message: string
    errorMessages?: Record<string, unknown>[]
  }
  
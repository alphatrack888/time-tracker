import { Server } from 'socket.io';
import { logger } from '../shared/logger';

// Type-safe socket instance export
export let socketIO: Server | null = null;

export const setSocketIO = (io: Server) => {

  socketIO = io;
  logger.info('✅ Socket.IO instance set successfully');
};

export const getSocketIO = (): Server | null => {
  return socketIO;
};

// Enhanced emit function with better error handling and logging
export const emitEvent = (
  event: string,
  data: any,
  room?: string
): boolean => {
  if (!socketIO) {
    logger.warn(`⚠️  Socket.IO not initialized - Skipping event: ${event}`);
    return false;
  }

  try {
    const timestamp = new Date().toISOString();
    const eventData = {
      ...data,
      timestamp,
      event
    };

    if (room) {
      socketIO.to(room).emit(event, eventData);
      logger.debug(`📡 Emitted event '${event}' to room '${room}'`);
    } else {
      socketIO.emit(event, eventData);
      logger.debug(`📡 Emitted event '${event}' to all clients`);
    }
    
    return true;
  } catch (error) {
    logger.error(`❌ Socket emit failed for event ${event}:`, error);
    return false;
  }
};

// Emit to specific user
export const emitToUser = (
  userId: string,
  event: string,
  data: any
): boolean => {
  return emitEvent(event, data, `user:${userId}`);
};

// Emit to users with specific role
export const emitToRole = (
  role: string,
  event: string,
  data: any
): boolean => {
  return emitEvent(event, data, `role:${role}`);
};

// Emit notification to user
export const emitNotificationToUser = (
  userId: string,
  notification: any
): boolean => {
  return emitToUser(userId, `notification::${userId}`, {
    type: 'notification',
    data: notification
  });
};

// Broadcast system message
export const broadcastSystemMessage = (
  message: string,
  type: 'info' | 'warning' | 'error' = 'info'
): boolean => {
  return emitEvent('system:message', {
    message,
    type,
    timestamp: new Date().toISOString()
  });
};

// Get connected clients count
export const getConnectedClientsCount = (): number => {
  if (!socketIO) {
    return 0;
  }
  
  try {
    return socketIO.engine.clientsCount;
  } catch (error) {
    logger.error('❌ Failed to get connected clients count:', error);
    return 0;
  }
};

// Check if Socket.IO is ready
export const isSocketIOReady = (): boolean => {
  return socketIO !== null;
};
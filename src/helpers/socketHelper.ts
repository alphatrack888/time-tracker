import colors from 'colors'
import { Server, Socket } from 'socket.io'
import { logger } from '../shared/logger'
import { onlineUsers } from '../server'
import { Notification } from '../app/modules/notifications/notifications.model'
import { USER_ROLES } from '../enum/user'
import { JwtPayload } from 'jsonwebtoken'
import { socketMiddleware } from '../app/middleware/socketAuth'

// Define interface for socket with user data
export type SocketWithUser = {
  user?: JwtPayload & {
    authId: string
    role: string
  }
} & Socket

const socket = (io: Server) => {
  // Enhanced Socket.IO server configuration
  io.engine.generateId = () => {
    // Custom ID generation for better tracking
    return `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Apply authentication middleware to all connections
  io.use(
    socketMiddleware.socketAuth(
      USER_ROLES.COMPANY,
      USER_ROLES.ADMIN,
      USER_ROLES.EMPLOYEES,
      USER_ROLES.SUPER_ADMIN,
    ),
  )

  // Enhanced connection handling
  io.on('connection', (socket: SocketWithUser) => {
    const connectionTime = new Date().toISOString()
    
    if (socket.user) {
      // Store user with additional metadata
      onlineUsers.set(socket.id, {
        authId: socket.user.authId,
        role: socket.user.role,
        connectedAt: connectionTime,
        lastActivity: connectionTime
      })
      
      logger.info(colors.blue(`⚡ User ${socket.user.authId} (${socket.user.role}) connected [${socket.id}]`))
      
      // Join user to their personal room for targeted messaging
      socket.join(`user:${socket.user.authId}`)
      
      // Join role-based rooms
      socket.join(`role:${socket.user.role}`)
      
      // Send connection confirmation
      socket.emit('connection:confirmed', {
        socketId: socket.id,
        connectedAt: connectionTime,
        user: {
          authId: socket.user.authId,
          role: socket.user.role
        }
      })

      registerEventHandlers(socket)
      
      // Send initial notifications
      sendNotificationsToUser(socket)
    } else {
      logger.warn(`⚠️  Unauthenticated connection attempt [${socket.id}]`)
      socket.disconnect(true)
    }
  })

  // Server-level error handling
  io.on('error', (error) => {
    logger.error('❌ Socket.IO server error:', error)
  })

  // Connection error handling
  io.engine.on('connection_error', (error) => {
    logger.error('❌ Socket.IO connection error:', error)
  })
}

// Enhanced event handlers
const registerEventHandlers = (socket: SocketWithUser) => {
  // Heartbeat/ping handler
  socket.on('ping', (callback) => {
    if (socket.user) {
      // Update last activity
      const userData = onlineUsers.get(socket.id)
      if (userData) {
        userData.lastActivity = new Date().toISOString()
        onlineUsers.set(socket.id, userData)
      }
    }
    
    if (typeof callback === 'function') {
      callback('pong')
    }
  })

  // Join room handler
  socket.on('join:room', (roomName: string, callback) => {
    try {
      socket.join(roomName)
      logger.info(`👥 User ${socket.user?.authId} joined room: ${roomName}`)
      
      if (typeof callback === 'function') {
        callback({ success: true, room: roomName })
      }
    } catch (error) {
      logger.error(`❌ Failed to join room ${roomName}:`, error)
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to join room' })
      }
    }
  })

  // Leave room handler
  socket.on('leave:room', (roomName: string, callback) => {
    try {
      socket.leave(roomName)
      logger.info(`👋 User ${socket.user?.authId} left room: ${roomName}`)
      
      if (typeof callback === 'function') {
        callback({ success: true, room: roomName })
      }
    } catch (error) {
      logger.error(`❌ Failed to leave room ${roomName}:`, error)
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to leave room' })
      }
    }
  })

  // Enhanced disconnect handler
  socket.on('disconnect', (reason) => {
    const userData = onlineUsers.get(socket.id)
    onlineUsers.delete(socket.id)
    
    const connectionDuration = userData?.connectedAt
      ? Date.now() - new Date(userData.connectedAt).getTime()
      : 0
    
    logger.info(colors.red(
      `User ${socket.user?.authId || 'Unknown'} disconnected ⚡ [${socket.id}] - Reason: ${reason}, Duration: ${Math.round(connectionDuration / 1000)}s`
    ))
  })

  // Error handler for individual socket
  socket.on('error', (error) => {
    logger.error(`❌ Socket error for user ${socket.user?.authId} [${socket.id}]:`, error)
  })
}

// Enhanced notification sender
const sendNotificationsToUser = async (socket: SocketWithUser) => {
  try {
    const userId = socket.user?.authId
    if (!userId) return

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ receiver: userId })
        .populate([{ path: 'sender', select: 'name profile' }])
        .sort({ createdAt: -1 })
        .limit(50) // Limit to recent notifications
        .lean(),
      Notification.countDocuments({ receiver: userId, isRead: false }),
    ])

    socket.emit(`notifications::${userId}`, {
      notifications,
      unreadCount,
      timestamp: new Date().toISOString()
    })
    
    logger.debug(`📨 Sent ${notifications.length} notifications to user ${userId}`)
  } catch (error) {
    logger.error(`❌ Error sending notifications to user ${socket.user?.authId}:`, error)
  }
}

// Utility functions for external use
export const getOnlineUsersCount = (): number => {
  return onlineUsers.size
}

export const getOnlineUsersList = (): Array<{socketId: string, authId: string, role: string, connectedAt: string}> => {
  const users: Array<{socketId: string, authId: string, role: string, connectedAt: string}> = []
  
  onlineUsers.forEach((userData, socketId) => {
    users.push({
      socketId,
      authId: userData.authId,
      role: userData.role,
      connectedAt: userData.connectedAt
    })
  })
  
  return users
}

export const isUserOnline = (authId: string): boolean => {
  for (const userData of onlineUsers.values()) {
    if (userData.authId === authId) {
      return true
    }
  }
  return false
}

export const socketHelper = {
  socket,
  sendNotificationsToUser,
  getOnlineUsersCount,
  getOnlineUsersList,
  isUserOnline
}

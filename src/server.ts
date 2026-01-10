import colors from 'colors'
import mongoose from 'mongoose'
import { Server } from 'socket.io'
import app from './app'
import config from './config'

import { errorLogger, logger } from './shared/logger'
import { socketHelper } from './helpers/socketHelper'
import { UserServices } from './app/modules/user/user.service'
import { setSocketIO } from './helpers/socketInstances'
// import { systemMonitor } from './helpers/system-monitor'

//uncaught exception
process.on('uncaughtException', error => {
  errorLogger.error('UnhandledException Detected', error)
  process.exit(1)
})

export const onlineUsers = new Map()
let server: any
let io: Server

async function main() {
  try {
    // Initialize Redis connection

    logger.info(colors.blue(`🚀 Connecting to database: ${config.database_url}`))
    // Connect to MongoDB
    await mongoose.connect(config.database_url as string)
    logger.info(colors.green(`🚀 Database connected successfully: ${config.database_url}`))

    const port = typeof config.port === 'number' ? config.port : Number(config.port)

    server = app.listen(port, config.ip_address as string, () => {
      logger.info(colors.yellow(`♻️  Application listening on port:${config.port}`))
    })

    // Initialize Socket.IO with enhanced configuration
    io = new Server(server, {
      pingTimeout: 60000,
      pingInterval: 25000,
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
    })

    // Create admin user
    await UserServices.createAdmin()

  
    // Initialize Socket.IO handlers
    socketHelper.socket(io)
    setSocketIO(io)
    //@ts-ignore
    global.io = io



    logger.info(colors.green('🚀 Server initialization completed successfully'))

  } catch (error) {
    errorLogger.error(colors.red('🤢 Failed to initialize server:'), error)
    if (config.node_env === 'development') {
      console.error(error)
    }
    process.exit(1)
  }

  // Handle unhandled rejections
  process.on('unhandledRejection', (error) => {
    errorLogger.error('UnhandledRejection Detected', error)
    gracefulShutdown('unhandledRejection')
  })
}

// Graceful shutdown function
async function gracefulShutdown(signal: string) {
  logger.info(`🛑 ${signal} received, starting graceful shutdown...`)

  try {
    // Stop accepting new connections
    if (server) {
      server.close(() => {
        logger.info('✅ HTTP server closed')
      })
    }

    // Close Socket.IO
    if (io) {
      io.close(() => {
        logger.info('✅ Socket.IO server closed')
      })
    }

    // Close MongoDB connection
    await mongoose.connection.close()
    logger.info('✅ Database connection closed')

    logger.info('✅ Graceful shutdown completed')
    process.exit(0)
  } catch (error) {
    logger.error('❌ Error during graceful shutdown:', error)
    process.exit(1)
  }
}

// Signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

main()

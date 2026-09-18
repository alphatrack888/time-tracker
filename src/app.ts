import cors from 'cors'
import express, { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import mongoose from 'mongoose'

import router from './routes'
import { Morgan } from './shared/morgan'
import cookieParser from 'cookie-parser'
import globalErrorHandler from './app/middleware/globalErrorHandler'
import passport from './app/modules/auth/passport.auth/config/passport'
import { SubscriptionController } from './app/modules/subscription/subscription.controller'

const app = express()

//morgan
app.use(Morgan.successHandler)
app.use(Morgan.errorHandler)
//body parser
app.use(
  cors({
    origin: ['http://10.10.7.101:9000', 'http://10.10.7.101:9501', 'http://localhost:9000','http://localhost:9501', 'https://company.alphatrack.app', 'https://admin.alphatrack.app',"http://localhost:5173", "http://localhost:5174","http://10.10.7.79:9501","http://10.10.7.79:9502"],
    credentials: true,
  }),
)

app.post(
  '/api/v1/webhook',
  express.raw({ type: 'application/json' }),
    express.raw({ type: 'application/json' }),

  SubscriptionController.handleWebhook,
);

app.use(express.json())
app.use(passport.initialize())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

//health check
const mongoStateNames: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
}

app.get('/health', (req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState
  const dbConnected = dbState === 1
  const healthy = dbConnected

  res.status(healthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
    success: healthy,
    status: healthy ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: mongoStateNames[dbState] ?? 'unknown',
  })
})

//router
app.use('/api/v1', router)

//live response
app.get('/', (req: Request, res: Response) => {
  res.send(`
    <div style="
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: radial-gradient(circle at top left, #1e003e, #5e00a5);
      color: #fff;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      text-align: center;
      padding: 2rem;
    ">
      <div>
        <h1 style="font-size: 3rem; margin-bottom: 1rem;">
          🛑 Whoa there, hacker man.
        </h1>
        <p style="font-size: 1.4rem; line-height: 1.6;">
          You really just typed <code style="color:#ffd700;">'/'</code> in your browser and expected magic?<br><br>
          This isn’t Hogwarts, and you’re not the chosen one. 🧙‍♂️<br><br>
          Honestly, even my 404 page gets more action than this route. 💀
        </p>
        <p style="margin-top: 2rem; font-size: 1rem; opacity: 0.7;">
          Now go back... and try something useful. Or not. I’m just a server.
        </p>
      </div>
    </div>
  `)
})


//global error handle
app.use(globalErrorHandler)


app.use((req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: 'Lost, are we?',
    errorMessages: [
      {
        path: req.originalUrl,
        message: "Congratulations, you've reached a completely useless API endpoint 👏",
      },
      {
        path: '/docs',
        message: "Hint: Maybe try reading the docs next time? 📚",
      },
    ],
    roast: "404 brain cells not found. Try harder. 🧠❌",
    timestamp: new Date().toISOString(),
  });
});


export default app

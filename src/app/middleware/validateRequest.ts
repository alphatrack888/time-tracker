import { NextFunction, Request, Response } from 'express'
import { AnyZodObject, ZodEffects } from 'zod'

const validateRequest =
  (schema: AnyZodObject | ZodEffects<AnyZodObject>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {
      // Only req.body is written back. Most schemas here only declare a
      // `body` shape, so overwriting req.query/req.params with the parsed
      // result would silently wipe them out (e.g. route params like :id)
      // wherever a schema doesn't also declare that key.
      const { body } = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        cookies: req.cookies,
      })
      req.body = body
      return next()
    } catch (error) {
      next(error)
    }
  }

export default validateRequest

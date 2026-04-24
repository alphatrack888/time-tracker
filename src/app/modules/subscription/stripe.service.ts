import Stripe from 'stripe'
import config from '../../../config'
import { logger } from '../../../shared/logger'

class StripeService {
  private stripe: Stripe

  constructor() {
    if (!config.stripe.secret_key) {
      throw new Error('Stripe secret key is required')
    }

    this.stripe = new Stripe(config.stripe.secret_key, {
      apiVersion: '2025-07-30.basil',
      typescript: true,
    })
  }

  // Customer Management
  async createCustomer(email: string, name?: string, metadata?: Record<string, string>): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: metadata || {},
      })

      logger.info(`Stripe customer created: ${customer.id}`)
      return customer
    } catch (error) {
      logger.error('Error creating Stripe customer:', error)
      throw error
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId)
      return customer as Stripe.Customer
    } catch (error) {
      logger.error(`Error retrieving Stripe customer ${customerId}:`, error)
      throw error
    }
  }

  async updateCustomer(customerId: string, params: Stripe.CustomerUpdateParams): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.update(customerId, params)
      logger.info(`Stripe customer updated: ${customerId}`)
      return customer
    } catch (error) {
      logger.error(`Error updating Stripe customer ${customerId}:`, error)
      throw error
    }
  }

  // Subscription Management
  async createSubscription(params: {
    customerId: string
    priceId: string
    trialPeriodDays?: number
    paymentMethodId?: string
    metadata?: Record<string, string>
  }): Promise<Stripe.Subscription> {
    try {
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: params.customerId,
        items: [{ price: params.priceId }],
        metadata: params.metadata || {},
        expand: ['latest_invoice.payment_intent', 'latest_invoice'],

      }

      // Add trial period if specified
      if (params.trialPeriodDays && params.trialPeriodDays > 0) {
        subscriptionParams.trial_period_days = params.trialPeriodDays
      }

      // Add payment method if provided
      if (params.paymentMethodId) {
        subscriptionParams.default_payment_method = params.paymentMethodId
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionParams)

      logger.info(`Stripe subscription created: ${subscription.id}`)
      return subscription
    } catch (error) {
      logger.error('Error creating Stripe subscription:', error)
      throw error
    }
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice.payment_intent'],
      })
      return subscription
    } catch (error) {
      logger.error(`Error retrieving Stripe subscription ${subscriptionId}:`, error)
      throw error
    }
  }

  async updateSubscription(
    subscriptionId: string,
    params: Stripe.SubscriptionUpdateParams,
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, params)
      logger.info(`Stripe subscription updated: ${subscriptionId}`)
      return subscription
    } catch (error) {
      logger.error(`Error updating Stripe subscription ${subscriptionId}:`, error)
      throw error
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = false,
  ): Promise<Stripe.Subscription> {
    try {
      let subscription: Stripe.Subscription

      if (cancelAtPeriodEnd) {
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        })
      } else {
        subscription = await this.stripe.subscriptions.cancel(subscriptionId)
      }

      logger.info(`Stripe subscription canceled: ${subscriptionId}`)
      return subscription
    } catch (error) {
      logger.error(`Error canceling Stripe subscription ${subscriptionId}:`, error)
      throw error
    }
  }

  // Payment Method Management
  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      })

      logger.info(`Payment method attached: ${paymentMethodId} to customer: ${customerId}`)
      return paymentMethod
    } catch (error) {
      logger.error('Error attaching payment method:', error)
      throw error
    }
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      })

      logger.info(`Default payment method set for customer: ${customerId}`)
      return customer
    } catch (error) {
      logger.error('Error setting default payment method:', error)
      throw error
    }
  }

  // Checkout Session
  async createCheckoutSession(params: {
    customerId: string
    priceId: string
    successUrl: string
    cancelUrl: string
    trialPeriodDays?: number
    metadata?: Record<string, string>
  }): Promise<Stripe.Checkout.Session> {
    try {
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: params.customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: params.priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata || {},
      }

      // Add trial period and metadata to subscription
      if (params.trialPeriodDays && params.trialPeriodDays > 0) {
        sessionParams.subscription_data = {
          trial_period_days: params.trialPeriodDays,
          metadata: params.metadata || {}, // ← Add metadata to subscription
        }
      } else {
        sessionParams.subscription_data = {
          metadata: params.metadata || {}, // ← Add metadata to subscription
        }
      }

      const session = await this.stripe.checkout.sessions.create(sessionParams)

      logger.info(`Stripe checkout session created: ${session.id}`)
      return session
    } catch (error) {
      logger.error('Error creating Stripe checkout session:', error)
      throw error
    }
  }

  // Invoice Management
  // async getUpcomingInvoice(customerId: string): Promise<Stripe.UpcomingInvoice> {
  //   try {
  //     const invoice = await this.stripe.invoices.retrieveUpcoming({
  //       customer: customerId,
  //     })
  //     return invoice
  //   } catch (error) {
  //     logger.error(`Error retrieving upcoming invoice for customer ${customerId}:`, error)
  //     throw error
  //   }
  // }

  // Webhook Verification
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    try {
      if (!config.stripe.webhook_secret) {
        throw new Error('Stripe webhook secret is required')
      }

      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhook_secret,
      )

      return event
    } catch (error) {
      logger.error('Error constructing webhook event:', error)
      throw error
    }
  }

  // Product and Price Management (for admin use)
  async createProduct(params: {
    name: string
    description?: string
    metadata?: Record<string, string>
  }): Promise<Stripe.Product> {
    try {
      const product = await this.stripe.products.create({
        name: params.name,
        description: params.description,
        metadata: params.metadata || {},
      })

      logger.info(`Stripe product created: ${product.id}`)
      return product
    } catch (error) {
      logger.error('Error creating Stripe product:', error)
      throw error
    }
  }

  async createPrice(params: {
    productId: string
    unitAmount: number
    currency: string
    interval: 'month' | 'year'
    intervalCount?: number
    metadata?: Record<string, string>
  }): Promise<Stripe.Price> {
    try {
      const price = await this.stripe.prices.create({
        product: params.productId,
        unit_amount: params.unitAmount,
        currency: params.currency,
        recurring: {
          interval: params.interval,
          interval_count: params.intervalCount || 1,
        },
        metadata: params.metadata || {},
      })

      logger.info(`Stripe price created: ${price.id}`)
      return price
    } catch (error) {
      logger.error('Error creating Stripe price:', error)
      throw error
    }
  }

  // Usage tracking (for metered billing if needed)
  // async createUsageRecord(subscriptionItemId: string, quantity: number): Promise<Stripe.UsageRecord> {
  //   try {
  //     const usageRecord = await this.stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
  //       quantity,
  //       timestamp: Math.floor(Date.now() / 1000),
  //     })

  //     logger.info(`Usage record created for subscription item: ${subscriptionItemId}`)
  //     return usageRecord
  //   } catch (error) {
  //     logger.error('Error creating usage record:', error)
  //     throw error
  //   }
  // }

  // Update product
  async updateProduct(productId: string, params: Stripe.ProductUpdateParams): Promise<Stripe.Product> {
    try {
      const product = await this.stripe.products.update(productId, params)
      logger.info(`Stripe product updated: ${productId}`)
      return product
    } catch (error) {
      logger.error(`Error updating Stripe product ${productId}:`, error)
      throw error
    }
  }

  // Archive price (Stripe doesn't allow price deletion, only archiving)
  async archivePrice(priceId: string): Promise<Stripe.Price> {
    try {
      const price = await this.stripe.prices.update(priceId, { active: false })
      logger.info(`Stripe price archived: ${priceId}`)
      return price
    } catch (error) {
      logger.error(`Error archiving Stripe price ${priceId}:`, error)
      throw error
    }
  }

  // Archive product
  async archiveProduct(productId: string): Promise<Stripe.Product> {
    try {
      const product = await this.stripe.products.update(productId, { active: false })
      logger.info(`Stripe product archived: ${productId}`)
      return product
    } catch (error) {
      logger.error(`Error archiving Stripe product ${productId}:`, error)
      throw error
    }
  }

  // Delete product (only works if no prices or other dependencies)
  async deleteProduct(productId: string): Promise<Stripe.DeletedProduct> {
    try {
      const deletedProduct = await this.stripe.products.del(productId)
      logger.info(`Stripe product deleted: ${productId}`)
      return deletedProduct
    } catch (error) {
      logger.error(`Error deleting Stripe product ${productId}:`, error)
      throw error
    }
  }


  // Retry invoice payment
  async retryInvoicePayment(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.pay(invoiceId)
      logger.info(`Invoice payment retried: ${invoiceId}`)
      return invoice
    } catch (error) {
      logger.error(`Error retrying invoice payment ${invoiceId}:`, error)
      throw error
    }
  }

  // Pause subscription
  async pauseSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        pause_collection: {
          behavior: 'keep_as_draft',
        },
      })
      logger.info(`Stripe subscription paused: ${subscriptionId}`)
      return subscription
    } catch (error) {
      logger.error(`Error pausing Stripe subscription ${subscriptionId}:`, error)
      throw error
    }
  }

  // Resume subscription
  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        pause_collection: null,
      })
      logger.info(`Stripe subscription resumed: ${subscriptionId}`)
      return subscription
    } catch (error) {
      logger.error(`Error resuming Stripe subscription ${subscriptionId}:`, error)
      throw error
    }
  }

  // Get payment method
  async getPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId)
      return paymentMethod
    } catch (error) {
      logger.error(`Error retrieving payment method ${paymentMethodId}:`, error)
      throw error
    }
  }

  // List customer payment methods
  async listCustomerPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      })
      return paymentMethods.data
    } catch (error) {
      logger.error(`Error listing payment methods for customer ${customerId}:`, error)
      throw error
    }
  }

  // Delete customer (for GDPR compliance)
  async deleteCustomer(customerId: string): Promise<Stripe.DeletedCustomer> {
    try {
      const deletedCustomer = await this.stripe.customers.del(customerId)
      logger.info(`Stripe customer deleted: ${customerId}`)
      return deletedCustomer
    } catch (error) {
      logger.error(`Error deleting Stripe customer ${customerId}:`, error)
      throw error
    }
  }

  // Create setup intent (for saving payment methods without immediate charge)
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
      })
      logger.info(`Setup intent created for customer: ${customerId}`)
      return setupIntent
    } catch (error) {
      logger.error('Error creating setup intent:', error)
      throw error
    }
  }

  // Get subscription with expanded data
  async getSubscriptionExpanded(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: [
          'latest_invoice',
          'latest_invoice.payment_intent',
          'customer',
          'items.data.price.product',
        ],
      })
      return subscription
    } catch (error) {
      logger.error(`Error retrieving expanded subscription ${subscriptionId}:`, error)
      throw error
    }
  }

  // Get monthly revenue data from Stripe invoices
  async getMonthlyRevenueData(year: number): Promise<{ month: number; revenue: number }[]> {
    try {
      const startDate = new Date(`${year}-01-01`)
      const endDate = new Date(`${year}-12-31`)
      
      // Get all paid invoices for the year with pagination
      let allInvoices: Stripe.Invoice[] = []
      let hasMore = true
      let startingAfter: string | undefined

      while (hasMore) {
        const invoices = await this.stripe.invoices.list({
          status: 'paid',
          created: {
            gte: Math.floor(startDate.getTime() / 1000),
            lte: Math.floor(endDate.getTime() / 1000),
          },
          limit: 100,
          starting_after: startingAfter,
        })

        allInvoices = allInvoices.concat(invoices.data)
        hasMore = invoices.has_more
        
        if (hasMore && invoices.data.length > 0) {
          startingAfter = invoices.data[invoices.data.length - 1].id
        }
      }

      // Group invoices by month and calculate revenue
      const monthlyRevenue: { [key: number]: number } = {}
      
      for (const invoice of allInvoices) {
        const invoiceDate = new Date(invoice.created * 1000)
        const month = invoiceDate.getMonth() + 1 // 1-12
        const amount = invoice.amount_paid / 100 // Convert from cents to dollars
        
        if (!monthlyRevenue[month]) {
          monthlyRevenue[month] = 0
        }
        monthlyRevenue[month] += amount
      }

      // Convert to array format
      const result: { month: number; revenue: number }[] = []
      for (let month = 1; month <= 12; month++) {
        result.push({
          month,
          revenue: monthlyRevenue[month] || 0
        })
      }

      logger.info(`Retrieved monthly revenue data for year ${year} (${allInvoices.length} invoices processed)`)
      return result
    } catch (error) {
      logger.error(`Error retrieving monthly revenue data for year ${year}:`, error)
      throw error
    }
  }
}

export const stripeService = new StripeService()
import { SubscriptionPlan } from './subscription-plan.model'
import { stripeService } from './stripe.service'
import { logger } from '../../../shared/logger'

// Default subscription plans for FleetSync
const defaultPlans = [
  // Driver Plans
  {
    name: 'Driver Basic',
    description: 'Perfect for individual drivers starting their journey',
    price: 29.99,
    currency: 'usd',
    interval: 'month' as const,
    intervalCount: 1,
    trialPeriodDays: 10,
    features: [
      'Basic profile creation',
      'Job search and applications',
      'Basic messaging',
      'Mobile app access',
      'Email support',
    ],
    maxUsers: 1,
    maxTrucks: 1,
    userTypes: ['driver'],
    priority: 1,
  },
  {
    name: 'Driver Pro',
    description: 'Advanced features for professional drivers',
    price: 49.99,
    currency: 'usd',
    interval: 'month' as const,
    intervalCount: 1,
    trialPeriodDays: 10,
    features: [
      'Everything in Basic',
      'Advanced profile customization',
      'Priority job matching',
      'Unlimited messaging',
      'Route optimization',
      'Earnings tracking',
      'Priority support',
    ],
    maxUsers: 1,
    maxTrucks: 3,
    userTypes: ['driver'],
    priority: 2,
  },

  // Company Plans
  {
    name: 'Company Starter',
    description: 'Ideal for small trucking companies',
    price: 99.99,
    currency: 'usd',
    interval: 'month' as const,
    intervalCount: 1,
    trialPeriodDays: 10,
    features: [
      'Company profile creation',
      'Post unlimited jobs',
      'Driver search and filtering',
      'Basic fleet management',
      'Messaging system',
      'Basic analytics',
      'Email support',
    ],
    maxUsers: 5,
    maxTrucks: 10,
    userTypes: ['company'],
    priority: 1,
  },
  {
    name: 'Company Professional',
    description: 'Comprehensive solution for growing companies',
    price: 199.99,
    currency: 'usd',
    interval: 'month' as const,
    intervalCount: 1,
    trialPeriodDays: 10,
    features: [
      'Everything in Starter',
      'Advanced fleet management',
      'Driver performance tracking',
      'Route optimization',
      'Compliance management',
      'Advanced analytics',
      'API access',
      'Priority support',
    ],
    maxUsers: 25,
    maxTrucks: 50,
    userTypes: ['company'],
    priority: 2,
  },
  {
    name: 'Company Enterprise',
    description: 'Full-featured solution for large enterprises',
    price: 499.99,
    currency: 'usd',
    interval: 'month' as const,
    intervalCount: 1,
    trialPeriodDays: 10,
    features: [
      'Everything in Professional',
      'Unlimited users and trucks',
      'Custom integrations',
      'White-label options',
      'Dedicated account manager',
      'Custom reporting',
      'SLA guarantee',
      '24/7 phone support',
    ],
    maxUsers: 999,
    maxTrucks: 999,
    userTypes: ['company'],
    priority: 3,
  },

  // Mechanic Plans
  {
    name: 'Mechanic Basic',
    description: 'Essential tools for independent mechanics',
    price: 39.99,
    currency: 'usd',
    interval: 'month' as const,
    intervalCount: 1,
    trialPeriodDays: 10,
    features: [
      'Service provider profile',
      'Service listings',
      'Customer messaging',
      'Basic scheduling',
      'Mobile app access',
      'Email support',
    ],
    maxUsers: 1,
    maxTrucks: 0, // Not applicable for mechanics
    userTypes: ['mechanic'],
    priority: 1,
  },
  {
    name: 'Mechanic Pro',
    description: 'Advanced features for professional mechanics',
    price: 79.99,
    currency: 'usd',
    interval: 'month' as const,
    intervalCount: 1,
    trialPeriodDays: 10,
    features: [
      'Everything in Basic',
      'Advanced scheduling system',
      'Inventory management',
      'Customer management',
      'Service history tracking',
      'Payment processing',
      'Analytics dashboard',
      'Priority support',
    ],
    maxUsers: 5,
    maxTrucks: 0,
    userTypes: ['mechanic'],
    priority: 2,
  },

  // Cook Plans
  {
    name: 'Cook Essential',
    description: 'Perfect for mobile food service providers',
    price: 34.99,
    currency: 'usd',
    interval: 'month' as const,
    intervalCount: 1,
    trialPeriodDays: 10,
    features: [
      'Food service profile',
      'Menu management',
      'Location tracking',
      'Customer messaging',
      'Basic scheduling',
      'Mobile app access',
      'Email support',
    ],
    maxUsers: 1,
    maxTrucks: 0,
    userTypes: ['cook'],
    priority: 1,
  },

  // Fuel Provider Plans
  {
    name: 'Fuel Provider Basic',
    description: 'Essential features for fuel service providers',
    price: 59.99,
    currency: 'usd',
    interval: 'month' as const,
    intervalCount: 1,
    trialPeriodDays: 10,
    features: [
      'Fuel provider profile',
      'Station/service listings',
      'Pricing management',
      'Customer messaging',
      'Basic analytics',
      'Mobile app access',
      'Email support',
    ],
    maxUsers: 3,
    maxTrucks: 0,
    userTypes: ['fuel_provider'],
    priority: 1,
  },
  {
    name: 'Fuel Provider Pro',
    description: 'Advanced features for fuel service networks',
    price: 119.99,
    currency: 'usd',
    interval: 'month' as const,
    intervalCount: 1,
    trialPeriodDays: 10,
    features: [
      'Everything in Basic',
      'Multi-location management',
      'Advanced pricing tools',
      'Fleet customer management',
      'Credit line management',
      'Advanced analytics',
      'API access',
      'Priority support',
    ],
    maxUsers: 15,
    maxTrucks: 0,
    userTypes: ['fuel_provider'],
    priority: 2,
  },
]

export async function seedSubscriptionPlans(): Promise<void> {
  try {
    logger.info('Starting subscription plans seeding...')

    // Check if plans already exist
    const existingPlansCount = await SubscriptionPlan.countDocuments()
    if (existingPlansCount > 0) {
      logger.info(`${existingPlansCount} subscription plans already exist. Skipping seed.`)
      return
    }

    // Create plans in Stripe and database
    for (const planData of defaultPlans) {
      try {
        // Create Stripe product
        const stripeProduct = await stripeService.createProduct({
          name: planData.name,
          description: planData.description,
          metadata: {
            userTypes: planData.userTypes.join(','),
            maxUsers: planData.maxUsers.toString(),
            maxTrucks: planData.maxTrucks.toString(),
          },
        })

        // Create Stripe price
        const stripePrice = await stripeService.createPrice({
          productId: stripeProduct.id,
          unitAmount: Math.round(planData.price * 100), // Convert to cents
          currency: planData.currency,
          interval: planData.interval,
          intervalCount: planData.intervalCount,
          metadata: {
            planName: planData.name,
          },
        })

        // Create local plan
        const plan = new SubscriptionPlan({
          ...planData,
          stripeProductId: stripeProduct.id,
          stripePriceId: stripePrice.id,
          isActive: true,
        })

        await plan.save()
        logger.info(`Created subscription plan: ${planData.name}`)
      } catch (error) {
        logger.error(`Error creating plan ${planData.name}:`, error)
        // Continue with other plans even if one fails
      }
    }

    logger.info('Subscription plans seeding completed successfully')
  } catch (error) {
    logger.error('Error seeding subscription plans:', error)
    throw error
  }
}

// Function to update existing plans (for migrations)
export async function updateSubscriptionPlans(): Promise<void> {
  try {
    logger.info('Updating subscription plans...')

    // Add any plan updates here
    // Example: Update features for existing plans
    
    logger.info('Subscription plans update completed')
  } catch (error) {
    logger.error('Error updating subscription plans:', error)
    throw error
  }
}

// Function to create a specific plan (for testing or manual creation)
export async function createSpecificPlan(planData: any): Promise<void> {
  try {
    // Create Stripe product
    const stripeProduct = await stripeService.createProduct({
      name: planData.name,
      description: planData.description,
      metadata: planData.metadata || {},
    })

    // Create Stripe price
    const stripePrice = await stripeService.createPrice({
      productId: stripeProduct.id,
      unitAmount: Math.round(planData.price * 100),
      currency: planData.currency,
      interval: planData.interval,
      intervalCount: planData.intervalCount || 1,
    })

    // Create local plan
    const plan = new SubscriptionPlan({
      ...planData,
      stripeProductId: stripeProduct.id,
      stripePriceId: stripePrice.id,
    })

    await plan.save()
    logger.info(`Created specific plan: ${planData.name}`)
  } catch (error) {
    logger.error(`Error creating specific plan:`, error)
    throw error
  }
}
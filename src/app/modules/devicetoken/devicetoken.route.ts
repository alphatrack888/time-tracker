import express from 'express';
import auth from '../../middleware/auth';
import rateLimitMiddleware from '../../middleware/rateLimitter';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLES } from '../../../enum/user';
import { DeviceTokenController } from './devicetoken.controller';
import { DeviceTokenValidations } from './devicetoken.validation';

const router = express.Router();

const anyAuthenticatedRole = [
  USER_ROLES.EMPLOYEES,
  USER_ROLES.COMPANY,
  USER_ROLES.ADMIN,
  USER_ROLES.SUPER_ADMIN,
];

// Phase 14 audit: a buggy or compromised client retrying registration in a
// tight loop (e.g. a token-refresh bug re-registering on every app resume)
// shouldn't be able to hammer this unbounded. 30/minute per IP is well
// above any legitimate client's real call frequency (once per login plus
// occasional token refreshes) but still bounds abuse. Placed before auth()
// so a flood of invalid-token requests is rejected at the cheap layer
// first, not after a JWT verification per request.
router.post(
  '/register',
  rateLimitMiddleware(30, 60_000),
  auth(...anyAuthenticatedRole),
  validateRequest(DeviceTokenValidations.register),
  DeviceTokenController.registerDevice,
);
router.get('/', auth(...anyAuthenticatedRole), DeviceTokenController.listMyDevices);
// Token is a path param (not a body) per the frozen contract in the
// integration plan — FCM/APNs tokens don't contain '/', so this is safe
// as a single path segment.
router.delete('/:token', auth(...anyAuthenticatedRole), DeviceTokenController.deregisterDevice);

export const DeviceTokenRoutes = router;

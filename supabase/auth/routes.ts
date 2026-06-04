/* routes.ts — single source of truth for app route paths.
 * Add your own protected routes here as the project grows.
 */
export const ROUTES = {
  root: '/',
  login: '/login',
  updatePassword: '/update-password',
} as const

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES]
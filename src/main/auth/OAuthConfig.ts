/**
 * Kick OAuth Configuration
 *
 * These credentials are used for authenticating with Kick's API.
 *
 * NOTE: For desktop/native applications, OAuth credentials must be embedded in the app.
 * This is standard practice for all desktop OAuth applications (Discord, Slack, Spotify, etc.)
 * and is an accepted limitation of the OAuth 2.0 flow for native apps.
 *
 * The redirect URI is restricted to localhost, which provides some security.
 * Kick's API has rate limiting and other protections against credential abuse.
 */

export const OAUTH_CONFIG = {
  clientId: '01K9ZHGD4F348KRRAK7CPHTHY6',
  clientSecret: 'f3602104698b236f390ed59f99743d95457e2ad93273c914728eb2bf2e016888',
  redirectUri: 'http://localhost:3000/callback'
} as const

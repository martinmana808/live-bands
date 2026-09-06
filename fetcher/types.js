// fetcher/types.js

/**
 * @typedef {Object} RawEvent
 * @property {string} artist          - Artist name as it appears on the source
 * @property {string} date            - ISO date "YYYY-MM-DD"
 * @property {string} venue           - Venue name as it appears on the source
 * @property {string} [ticketUrl]     - Direct ticket URL if available
 * @property {string} source          - Source adapter id (e.g. "bandsintown")
 */

/**
 * @typedef {Object} NormalizedEvent
 * @property {string} id              - Stable id: slug(artist)-date-slug(venue)
 * @property {string} artist          - Artist display name
 * @property {string} artistKey       - Normalized lowercase key for lookups
 * @property {string} date            - ISO date "YYYY-MM-DD"
 * @property {string} venue           - Venue display name
 * @property {string} venueKey        - Normalized lowercase key for matching
 * @property {string[]} ticketUrls    - All ticket URLs across sources
 * @property {string[]} sources       - Source ids that reported this event
 */

/**
 * @typedef {Object} EnrichedEvent
 * @property {string} id
 * @property {string} artist
 * @property {string} artistKey
 * @property {string} date
 * @property {string} venue
 * @property {string[]} ticketUrls
 * @property {string[]} sources
 * @property {string|null} country    - ISO 3166-1 alpha-2, or null if unknown
 * @property {string|null} spotifyId  - Spotify artist id, or null
 * @property {string|null} spotifyImage - Spotify artist thumbnail image URL, or null
 * @property {string} [firstSeenAt]   - ISO date the event was first observed
 */

/**
 * @typedef {Object} ArtistCacheEntry
 * @property {string} name
 * @property {string|null} country
 * @property {string} [countryResolvedBy] - resolver version that produced `country`
 * @property {string|null} spotifyId
 * @property {string|null} spotifyImage - Spotify artist thumbnail image URL, or null
 * @property {string} lookedUpAt     - ISO date
 */

export {};

import { Context, Path } from './deltas'

export interface SubscriptionManager {
  subscribe(
    command: SubscribeMessage,
    unsubscribes: Unsubscribes,
    errorCallback: (err: unknown) => void,
    callback: (msg: any) => void,
    user?: string
  ): void

  unsubscribe(msg: any, unsubscribes: Unsubscribes): void
}

export type Unsubscribes = Array<() => void>

/**
 * @see [Signal K Data Model](https://signalk.org/specification/1.7.0/doc/data_model.html)
 * @see {@link SubscriptionOptions.format}
 */
export enum SubscriptionFormat {
  delta = 'delta',
  full = 'full'
}

/**
 * The policy for sending messages.
 * @see {@link SubscriptionOptions.policy}
 */
export enum SubscriptionPolicy {
  /**
   * Send all changes as fast as they are received, but no faster than {@link SubscriptionOptions.minPeriod}. With this policy the client has an immediate copy of the current state of the server.
   */
  instant = 'instant',

  /**
   * Use instant policy, but if no changes are received before period, then resend the last known values.
   *
   * > [!WARNING]
   * > Not yet supported.
   */
  ideal = 'ideal',

  /**
   * Send the last known values every {@link SubscriptionOptions.period}.
   */
  fixed = 'fixed'
}

/**
 * A message to allow a client to subscribe for data updates from a signalk server
 *
 * @see [SignalK Specification: Subscription Protocol](https://signalk.org/specification/1.7.0/doc/subscription_protocol.html?highlight=subscribe#introduction)
 */
export interface SubscribeMessage {
  /**
   * The root path for all subsequent paths, usually a vessel's path.
   */
  context: Context

  /**
   * An array of paths to subscribe to, with optional criteria
   */
  subscribe: SubscriptionOptions[]

  /**
   * An optional session key that is used in STOMP and MQTT messages where there are no session facilities
   * @example
   * "d2f691ac-a5ed-4cb7-b361-9072a24ce6bc"
   */
  'websocket.connectionkey'?: string

  /**
   * A reply queue that is used in STOMP and MQTT messages where there are no session facilities.
   */
  'reply-to'?: string
}

/**
 * A path object with optional criteria to control output
 */
export interface SubscriptionOptions {
  /**
   * The path to subscribe to.
   */
  path?: Path

  /**
   * The subscription will be sent every period millisecs.
   */
  period?: number

  /**
   * The signal K format to use (full/delta) for the message.
   */
  format?: SubscriptionFormat

  /**
   * The policy for sending messages (instant/ideal/fixed).
   */
  policy?: SubscriptionPolicy

  /**
   * If policy=immediate or ideal, consequetive messages will be buffered until minPeriod has expired so the reciever is not swamped.
   */
  minPeriod?: number
}

/**
 * A message to allow a client to unsubscribe from data updates from a signalk server
 */
export interface UnsubscribeMessage {
  /**
   * The root path for all subsequent paths, usually a vessel's path.
   *
   * > [!NOTE]
   * > Currently only `*` is supported for the context.
   */
  context: '*'

  /**
   * An array of paths to unsubscribe from.

  * > [!NOTE]
   * > Currently only one entry is supported, and it must have `"path": "*"`.
   */
  unsubscribe: [
    {
      path: '*'
    }
  ]
}

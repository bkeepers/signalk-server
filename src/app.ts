/* eslint-disable @typescript-eslint/no-explicit-any */
import { Delta, FeatureInfo, ServerAPI, SKVersion } from '@signalk/server-api'
import { FullSignalK } from '@signalk/signalk-schema'
import { EventEmitter } from 'node:events'
import { Config } from './config/config'
import DeltaCache from './deltacache'
import { WithSecurityStrategy } from './security'
import { IRouter } from 'express'
import { ServerAppEvents } from './events'
import { Logging } from './logging'

export interface ServerApp
  extends ServerAPI,
    WithSecurityStrategy,
    IRouter,
    WithConfig,
    SignalKMessageHub {
  started: boolean
  interfaces: { [key: string]: any }
  intervals: NodeJS.Timeout[]
  providers: any[]
  server: any
  redirectServer?: any
  deltaCache: DeltaCache
  getProviderStatus: () => any
  lastServerEvents: { [key: string]: any }
  clients: number
  logging: Logging
}

export interface SignalKMessageHub extends EventEmitter<ServerAppEvents> {
  signalk: FullSignalK
  handleMessage: (
    id: string,
    delta: Partial<Delta>,
    skVersion?: SKVersion
  ) => void
}

export interface WithConfig {
  config: Config
}

export interface WithFeatures {
  getFeatures: (enabledOnly?: boolean) => FeatureInfo
}

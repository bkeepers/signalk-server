/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Delta,
  FeatureInfo,
  SelfIdentity,
  ServerAPI,
  SKVersion
} from '@signalk/server-api'
import { FullSignalK } from '@signalk/signalk-schema'
import { EventEmitter } from 'node:events'
import { Config } from './config/config'
import DeltaCache from './deltacache'
import { WithSecurityStrategy } from './security'
import { IRouter } from 'express'
import { ServerAppEvents, WithWrappedEmitter } from './events'
import { Logging } from './logging'
import { PluginManager } from './interfaces/plugins'

export interface ServerApp
  extends ServerAPI,
    WithSecurityStrategy,
    IRouter,
    WithConfig,
    SignalKMessageHub,
    ConfigApp,
    PluginManager,
    WithWrappedEmitter {
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

export interface ConfigApp extends WithConfig, SignalKMessageHub, SelfIdentity {
  argv: any
  env: any
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

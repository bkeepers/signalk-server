/*
 * Copyright 2017 Scott Bender <scott@scottbender.net>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createDebug } from './debug.js'
const debug = createDebug('signalk-server:discovery')
import canboatjs from '@canboat/canboatjs'
import { createSocket } from 'dgram'
import { Browser, Service, tcp } from 'dnssd2'
import { networkInterfaces } from 'os'
import { ServerApp } from './app.js'
import { PipedProviderConfig } from './pipedproviders.js'

type WsType = 'ws' | 'wss'

type GoFreeMessage = {
  SerialNumber: string
  Name: string
  IP: string
  Services: {
    Service: string
    Port: string
  }[]
}

export function runDiscovery(app: ServerApp) {
  if (canboatjs.discover) {
    try {
      canboatjs.discover(app)
    } catch (ex) {
      console.log(ex)
    }
  }

  discoverWLN10()
  discoverGoFree()
  discoverSignalkWs('ws')
  discoverSignalkWs('wss')

  function findUDPProvider(port: string) {
    return app.config.settings.pipedProviders.find((provider) => {
      return (
        provider.pipeElements &&
        provider.pipeElements.length === 1 &&
        provider.pipeElements[0].type === 'providers/simple' &&
        provider.pipeElements[0].options &&
        provider.pipeElements[0].options.type === 'NMEA0183' &&
        provider.pipeElements[0].options.subOptions.type === 'udp' &&
        provider.pipeElements[0].options.subOptions.port === port
      )
    })
  }

  function findTCPProvider(host: string, port: string) {
    return app.config.settings.pipedProviders.find((provider) => {
      return (
        provider.pipeElements &&
        provider.pipeElements.length === 1 &&
        provider.pipeElements[0].type === 'providers/simple' &&
        provider.pipeElements[0].options &&
        provider.pipeElements[0].options.type === 'NMEA0183' &&
        provider.pipeElements[0].options.subOptions.type === 'tcp' &&
        provider.pipeElements[0].options.subOptions.host === host &&
        provider.pipeElements[0].options.subOptions.port === port
      )
    })
  }

  function findWSProvider(
    ip: string,
    wsType: WsType,
    host: string,
    port: number | string
  ) {
    return app.config.settings.pipedProviders.find((provider) => {
      return (
        provider.pipeElements &&
        provider.pipeElements.length === 1 &&
        provider.pipeElements[0].type === 'providers/simple' &&
        provider.pipeElements[0].options &&
        provider.pipeElements[0].options.type === 'SignalK' &&
        provider.pipeElements[0].options.subOptions.type === wsType &&
        provider.pipeElements[0].options.subOptions.port?.toString() ===
          port.toString() &&
        (provider.pipeElements[0].options.subOptions.host === host ||
          provider.pipeElements[0].options.subOptions.host === ip)
      )
    })
  }

  function discoverGoFree() {
    const socket = createSocket('udp4')
    const found: string[] = []
    socket.on('message', function (buffer) {
      const msg = buffer.toString('utf8')
      if (msg[0] === '{') {
        try {
          const json: GoFreeMessage = JSON.parse(msg)
          const serial = json.SerialNumber
          if (json.Services && found.indexOf(serial) === -1) {
            json.Services.forEach((service) => {
              if (
                service.Service === 'nmea-0183' &&
                !findTCPProvider(json.IP, service.Port)
              ) {
                const id = `${json.Name} (${serial})`
                debug('found GoFree %s at %s:%s', id, json.IP, service.Port)
                found.push(serial)
                app.emit('discovered', {
                  id: id,
                  pipeElements: [
                    {
                      type: 'providers/simple',
                      options: {
                        type: 'NMEA0183',
                        subOptions: {
                          type: 'tcp',
                          host: json.IP,
                          port: service.Port
                        }
                      }
                    }
                  ]
                })
              }
            })
          }
        } catch (err) {
          debug('discoverGoFree:', err)
          return
        }
      }
    })
    socket.on('error', (error) => {
      debug('discoverGoFree:', error)
    })
    socket.on('close', () => {
      debug('discoverGoFree close')
    })
    debug('looking for GoFree broadcasting on UDP port 2052')
    try {
      socket.bind(2052, () => {
        try {
          socket.addMembership('239.2.1.1')
        } catch (ex) {
          debug('discoverGoFree:', ex)
        }
      })
    } catch (ex) {
      debug('discoverGoFree:', ex)
    }
    setTimeout(() => {
      if (socket) {
        socket.close()
      }
    }, 10000)
  }

  function discoverWLN10() {
    if (!findUDPProvider('2000')) {
      const socket = createSocket('udp4')
      socket.on('message', function (buffer) {
        const msg = buffer.toString('utf8')
        if (msg[0] === '$') {
          socket.close()
          app.emit('discovered', {
            id: 'WLN10',
            pipeElements: [
              {
                type: 'providers/simple',
                options: {
                  type: 'NMEA0183',
                  subOptions: {
                    type: 'udp',
                    port: '2000'
                  }
                }
              }
            ]
          })
        }
      })
      socket.on('error', (error) => {
        debug('discoverWLN10:', error)
      })
      socket.on('close', () => {
        debug('discoverWLN10 close')
      })
      debug('looking for a WLN10 broadcasting UDP port 2000')
      try {
        socket.bind(2000)
      } catch (ex) {
        debug('discoverWLN10:', ex)
      }
      setTimeout(() => {
        if (socket) {
          socket.close()
        }
      }, 5000)
    }
  }

  function discoverSignalkWs(wsType: WsType) {
    try {
      // mdns.excludeInterface('0.0.0.0')
      const browser = new Browser(tcp('signalk-' + wsType))

      browser.on('error', (err) => {
        debug('discoverSignalkWs:', err)
      })

      browser.on('serviceUp', (data: Service) => {
        try {
          if (
            !isLocalIP(data.addresses[0]) &&
            Array.isArray(data.type) &&
            data.type[0].name === 'signalk-' + wsType &&
            !findWSProvider(data.addresses[0], wsType, data.host, data.port)
          ) {
            debug('discoverSignalkWs found data[' + wsType + ']:', data)
            const providerId = wsType + '-' + data.host + ':' + data.port
            app.emit('discovered', {
              id: providerId,
              enabled: false,
              pipeElements: [
                {
                  type: 'providers/simple',
                  options: {
                    type: 'SignalK',
                    subOptions: {
                      type: wsType,
                      host: data.host,
                      port: data.port.toString(),
                      providerId: providerId
                    },
                    providerId: providerId
                  }
                }
              ]
            })
          }
        } catch (err) {
          debug('discoverSignalkWs:', err)
        }
      })

      browser.start()

      setTimeout(() => {
        try {
          browser.stop()
          debug('discoverSignalkWs close')
        } catch (err) {
          debug('discoverSignalkWs:', err)
        }
      }, 5000)
    } catch (err) {
      debug('discoverSignalkWs:', err)
    }
  }

  function isLocalIP(ip: string) {
    const nets = networkInterfaces()

    for (const interfaces of Object.values(nets)) {
      for (const net of interfaces ?? []) {
        if (net.family === 'IPv4' && !net.internal) {
          if (net.address === ip) {
            return true
          }
        }
      }
    }
    return false
  }
}

if (require.main === module) {
  const app = {
    config: {
      settings: {
        pipedProviders: []
      }
    },
    emit: (_: string, p: PipedProviderConfig) => {
      console.log(`found ${JSON.stringify(p)}`)
    }
  }
  module.exports.runDiscovery(app)
}

declare var require: any

const bigOak = require("./crowTech").bigOak
const defineRequestType = require("./crowTech").defineRequestType

defineRequestType("note", (nest, content, source, done) => {
  console.log(`${nest.name} received note: ${content}`)
  done()
})

function storage(nest, name) {
  return new Promise((resolve) => {
    nest.readStorage(name, (result) => resolve(result))
  })
}

var Timeout = class Timeout extends Error {}

function request(nest, target, type, content) {
  return new Promise((resolve, reject) => {
    let done = false
    function attempt(n) {
      nest.send(target, type, content, (failed, value) => {
        done = true
        if (failed) reject(failed)
        else resolve(value)
      })
      setTimeout(() => {
        if (done) return
        else if (n < 3) attempt(n + 1)
        else reject(new Timeout("Timed out"))
      }, 250)
    }
    attempt(1)
  })
}

function requestType(name, handler) {
  defineRequestType(name, (nest, content, source, callback) => {
    try {
      Promise.resolve(handler(nest, content, source)).then(
        (response) => callback(null, response),
        (failure) => callback(failure)
      )
    } catch (exception) {
      callback(exception)
    }
  })
}

requestType("ping", () => "pong")

var everywhere = require("./crowTech").everywhere

everywhere((nest) => {
  nest.state.gossip = []
})

function sendGossip(nest, message, exceptFor = null) {
  nest.state.gossip.push(message)
  for (let neighbor of nest.neighbors) {
    if (neighbor == exceptFor) continue
    request(nest, neighbor, "gossip", message)
  }
}

requestType("gossip", (nest, message, source) => {
  if (nest.state.gossip.includes(message)) return
  console.log(`${nest.name} received gossip '${message}' from ${source}`)
  sendGossip(nest, message, source)
})

requestType("connections", (nest, { name, neighbors }, source) => {
  let connections = nest.state.connections
  if (JSON.stringify(connections.get(name)) == JSON.stringify(neighbors)) return
  connections.set(name, neighbors)
  broadcastConnections(nest, name, source)
})

function broadcastConnections(nest, name, exceptFor = null) {
  for (let neighbor of nest.neighbors) {
    if (neighbor == exceptFor) continue
    request(nest, neighbor, "connections", {
      name,
      neighbors: nest.state.connections.get(name)
    })
  }
}

everywhere((nest) => {
  nest.state.connections = new Map()
  nest.state.connections.set(nest.name, nest.neighbors)
  broadcastConnections(nest, nest.name)
})

function findRoute(from, to, connections) {
  let work = [{ at: from, via: null }]
  for (let i = 0; i < work.length; i++) {
    let { at, via } = work[i]
    for (let next of connections.get(at) || []) {
      if (next == to) return via
      if (!work.some((w) => w.at == next)) {
        work.push({ at: next, via: via || next })
      }
    }
  }
  return null
}

function routeRequest(nest, target, type, content) {
  if (nest.neighbors.includes(target)) {
    return request(nest, target, type, content)
  } else {
    let via = findRoute(nest.name, target, nest.state.connections)
    if (!via) throw new Error(`No route to ${target}`)
    return request(nest, via, "route", { target, type, content })
  }
}

requestType("route", (nest, { target, type, content }) => {
  return routeRequest(nest, target, type, content)
})

requestType("storage", (nest, name) => storage(nest, name))

function anyStorage(nest, source, name) {
  if (source == nest.name) return storage(nest, name)
  else return routeRequest(nest, source, "storage", name)
}

async function locateScalpel(nest: any) {
  // Your code here.
  let current = nest.name
  //console.log(current);
  try {
    while (true) {
      let next = await anyStorage(nest, current, "scalpel")
      if (next == current) {
        return current
      }
      current = next
    }
  } catch (error) {
    return error
  }
}

function locateScalpel2(nest: any) {
  // Your code here.
  function getScalpel(current: string): any {
    return anyStorage(nest, current, "scalpel").then((next: any) => {
      if (next == current) return current
      else return getScalpel(next)
    })
  }
  return getScalpel(nest.name)
}

locateScalpel(bigOak).then(console.log)
locateScalpel2(bigOak).then(console.log)

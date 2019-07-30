const Client = require('./client');
const {
  parseMessageResponse
} = require('./utils');

// either node_redis or ioredis
function guessClient(client) {

  function guess(module, name) {
    try {
      const client = require(module);
      if (client) return (name || module);
    } catch {
      return null;
    }
  }

  return guess('ioredis') || guess('redis', 'node_redis');
}

const isReadyFuncs = {
  'node_redis' :(client) => client && client.connected,
  'redis' :(client) => client && client.connected,
  'ioredis': (client) => client && (client.status === 'ready')
};

function createClient(redis, clientType) {
  if (!clientType) {
    clientType = guessClient(redis);
  }
  const opts = {
    clientType,
    isClientReady: isReadyFuncs[clientType]
  };

  return new Client(redis, opts);
}


module.exports = {
  createClient,
  parseMessageResponse
};
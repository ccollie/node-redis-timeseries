const ms = require('ms');

function isNumeric(value) {
  const num = parseInt(value);
  return !isNaN(num);
}

function parseObjectResponse(reply) {
  // if (typeof reply === 'string') {
  //   return JSON.parse(reply);
  // }
  if (!Array.isArray(reply)) {
    return reply
  }
  const data = {};
  for (let i = 0; i < reply.length; i += 2) {
    let key = reply[i];
    let val = reply[i + 1];
    if (Array.isArray(val)) {
      data[key] = val;
    } else {
      data[key] = val;
    }
  }
  return data
}

function parseMessageResponse(reply) {
  if (typeof reply === 'string') {
    return JSON.parse(reply);
  }
  if (!Array.isArray(reply)) {
    return [];
  }
  return reply.map(([id, val]) => {
    return [id, parseObjectResponse(val)]
  });
}

function parseOptions(options) {
  const params = [];
  if (!options)
    return params;

  if (options.format) {
    params.push('FORMAT', options.format);
  }
  if (options.filter) {
    params.push('FILTER');
    if (typeof options.filter === 'string') {
      params.push(options.filter)
    } else {
      params.push(...options.filter);
    }
  }
  if (options.limit) {
    const { offset, count } = options.limit;

    if (!isNumeric(offset)) {
      throw new Error('limit.offset must be a number');
    }

    if (!isNumeric(count)) {
      throw new Error('limit.count must be a number');
    }

    params.push('LIMIT');
    params.push(offset);
    params.push(count);
  }
  if (options.aggregation) {
    const { type, timeBucket } = options.aggregation;
    // todo: validate values
    params.push('AGGREGATION');
    params.push(type);
    if (typeof timeBucket === 'string') {
      params.push( ms(timeBucket) );
    } else {
      params.push( timeBucket );
    }
    if (type === 'stats' || type === 'distinct') {
      if (!params.format) {
        params.format = 'json';
        params.push('FORMAT', 'json');
      }
    }
  }
  if (options.labels) {
    params.push('LABELS');
    if (!Array.isArray(options.labels)) {
      params.push(options.labels);
    } else {
      params.push(...[].concat(...options.labels));
    }
  }
  if (options.redact) {
    params.push('REDACT');
    if (!Array.isArray(options.redact)) {
      params.push(options.redact)
    } else {
      params.push(...[].concat(...options.redact));
    }
  }
  return params;
}

function parseKeyValueList(data) {
  let temp = [].concat(...data);
  const values = temp.reduce((res, value) => {
    if (value == null) {
      value = 'null';
    }
    if (typeof(value) == 'object') {
      value = Object.entries(value)
          .reduce((res, [k, v]) => {
            return res.concat(k, (v == null) ? 'null' : v)
          }, []);
    }
    return res.concat(value)
  }, []);
  if (values.length % 2 !== 0) {
    throw new Error('Key-value pairs mismatched');
  }
  return values;
}

function parseTs(ts) {
  if (ts instanceof Date) {
    return ts.getTime();
  }
  return ts;
}

const isString = (val) => typeof(val) === 'string';

module.exports = {
  parseMessageResponse,
  parseOptions,
  parseKeyValueList,
  parseTs,
  isString
};
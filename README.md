Node Redis Timeseries Lex
====================

Redis Timeseries is a Lua library implementing queryable time series on top of Redis using
[lexicographically sorted sets](https://redislabs.com/redis-best-practices/time-series/lexicographic-sorted-set-time-series/).

##### Encoding
Each data point is stored as a ZSET entry with score 0 and value in the form `timestamp|value`, 
where `value` is a set of arbitrary key value pairs encoded using message pack. The encoding is to preserve space, as
well as to preserve numeric values.

Because of Lua => Redis conversion issues ( [float truncation](https://redis.io/commands/eval#conversion-between-lua-and-redis-data-types) specifically )
we try to preserve float values by converting them to string as necessary on return from command calls.


#### Testing

A set of tests (using `jest`) are available in `__tests__`. 

If you have Redis running somewhere other than `localhost:6379`, you can supply
the `REDIS_URL` environment variable:

```bash
REDIS_URL='redis://host:port' npm run test
```


#### Usage
Load the script into redis, using [SCRIPT LOAD](https://redis.io/commands/script-load), or better yet,
use any of the redis client libraries available for the programming language of your choice. The docs
assumes that you have successfully done so and have acquired the asso

For example

```bash
evalsha b91594bd37521... 1 wait-time:5s range 1548149180000 1548149280000 AGGREGATION max 5000 
```


### Commands

#### add <a name="command-add"></a>
Add one or more data points to the timeseries at `key`. An abitrary number of key-value pairs can be specified.

```javascript
client.add(key, timestamp, [key, value ...]) 
```
Values which can be interpreted as numbers will be stored and treated as such.

Example

```javascript
client.add('readings:temp', 1564632000000, 'temperature', 18, 'altitude', 500, 'geohash', 'gbsvh', 'tag', 'important');
```

You can also specify values as a javascript object:

```javascript
const values = {
  temperature: 18, 
  altitude: 500, 
  geohash: 'gbsvh',
  tag: 'important'
};

client.add('readings:temp', 1564632000000, values);
```


#### get <a name="command-get"></a>
Get the value of a key associated with *timestamp*

```bash
evalsha sha 1 key get timestamp hash_label [LABELS field ...] [REDACT field ...]
```

##### Return Value
The command returns the key-value data associated with a timestamp.  

Examples

<pre><code>
await client.add('purchases', 1564632000000, 'item_id', 'cat-987H1', 'cust_id', '9A12YK2', 'amount', 2500)
const value = await client.getValue('purchases', 1564632000000);
1564632002100
1) "item_id"
2) "cat-987H1"
3) "cust_id"
4) "9A12YK2"
5) "amount"
6) "2500"
</code></pre>

The [labels](#labels-a-nameoption-labelsa) and [redact](#redact-a-nameoption-redacta) options can be used
to specify which fields are returned

<pre><code>
127.0.0.1:6379&gt; evalsha b91594bd37521 1 purchases add 1564632000000 item_id cat-987H1 cust_id 9A12YK2 amount 2500
1564632000000
127.0.0.1:6379&gt; evalsha b91594bd37521 1 purchases get 1564632000000 LABELS item_id amount
1564632002100
1) "item_id"
2) "cat-987H1"
5) "amount"
6) "2500"
127.0.0.1:6379&gt; evalsha b91594bd37521 1 purchases get 1564632000000 REDACT cust_id
1564632002100
1) "item_id"
2) "cat-987H1"
5) "amount"
6) "2500"
</code></pre>

#### del <a name="command-del"></a>
Removes the specified members from the series stored at the given timestamp. 
Non existing members are ignored. Returns the number of deleted entries.

```javascript
client.del(key, ...timestamps)
```

Example

```javascript
const deleteCount = await client.del('temperature', 1564632000000, 1564632010000);
```

##### Return Value
The number of entries actually deleted.


#### pop <a name="command-pop"></a>
Remove and return a value at a specified timestamp 

```bash
client.pop(key, timestamp, options)
```

Example

```javascript
const value = await client.pop('temperature', 1564632000000)
```

#### getSize <a name="command-size"></a>
Returns the number of items in the timeseries

```javascript
client.getSize(key)
```

##### Return Value
The number of items in the series.

#### count <a name="command-count"></a>
Returns the number of items in the timeseries between 2 timestamps. The range is inclusive.
Note that this and all other commands expecting a range also accept the special characters `-` and `+`
to specify the lowest and highest timestamps respectively.

```javascript
client.count(key, min, max, options)
```

Example
```javascript
const count = await client.count("temperature", 1564632000000, 1564635600000);
```
##### Return Value
The count of items in the subset defined by the given range and filter.

#### exists <a name="command-exists"></a>
Checks for the existence of a timestamp in the timeseries. 

```javascript
client.exists(key, timestamp)
```

Example
```javascript
const data = await client.exists('temperature', 1564632000000);
```

##### Return Value
`true` if the timestamp exists, `false` otherwise.


#### span <a name="command-span"></a>
Returns a 2 element array containing the highest and lowest timestamp in the series.

```javascript
const span = await client.getSpan(key)
```

#### times <a name="command-times"></a>
Returns a list of timestamps between *min* and *max*

```bash
evalsha sha 1 key min max
```


#### set <a name="command-set"></a>
Set the value associated with *timestamp*.

```javascript
client.set(key, timestamp,  key, value, [key, value ...])
```

```javascript
await client.set('rainfall:2019:06:19', 1564632000000, 'geohash', 'gbsut', 'inches', 2.0);
```

#### incrBy <a name="command-incrby"></a>
Increment the values of fields associated with *timestamp*.

```javascript
client.incrBy(key, timestamp, label, value, [label, value ...])
```
example

```javascript
client.incrBy('wait_time', 1564632000000, 'count', 1, 'value', 2000)
```

Note that javascript objects are supported as values, so the above is equivalent to:

```javascript
const delta = {
  count: 1,
  value: 2000
};
client.incrBy('wait_time', 1564632000000, delta)
```

##### Return Value
The post-update values by label.



## Querying <a name="querying"></a>
### range/revrange/poprange <a name="command-range"></a>
Query a timeseries by range and optionally aggregate the result. *`revrange`* returns the range of members 
in reverse order of timestamp, but is otherwise to its non-reversed counterpart. `poprange` functions similarly to `range`,
but removes the data in the range before returning it.

```bash
client.[range|revrange|poprange](key, min, max, options)
```

- `key` the timeseries redis key
- `min` the minimum timestamp value. The special character `-` can be used to specify the smallest timestamp
- `max` the maximum timestamp value. The special character `+` can be used to specify the largest timestamp

`min` and `max` specify an inclusive range.

#### Options <a name="options"></a>

##### filter <a name="option-filter"></a>

The `range` commands support a list of query filters.  

- `field=value` field equals value 
- `field!=value` field is not equal to value 
- `field>value` field greater than value 
- `field>=value` field greater than or equal value 
- `field<value` field less than value 
- `field<=value` field less than or equal value 
- `field=null` value is null or the field `field` does not exist in the data
- `field!=null` the field has a value 
- `field=(v1,v2, ...)` `field` equals one of the values in the list 
- `field!=(v1,v2, ...)` `field` value does not exist in the list. 

Any number of filter conditions can be provided, and the results are `ANDed` by default, however you may use an `OR`
if required.

```
FILTER purchase_price>5000 OR customer_status=preferred
```

For contains comparisons, avoid leading and trailing spaces with numbers. In other words use

```
FILTER size!=(10,20,30)
```

instead of

```
FILTER size!=(10 , 20, 30)
```

The parser supports quoted as well as non quoted strings e.g.

```
FILTER state!=(ready,"almost done",burnt to a crisp)
``` 

String as well as numeric comparisons are supported.

```javascript
const options = { 
  filter: ['tag=playoffs', 'value>10']
} 
const data = await client.range('game_scores', '-', '+', options);
```


##### aggregation <a name="option-aggregation"></a>

A timeseries range can be rolled up into buckets and aggregated by means of the aggregation option :

- `aggregation.type` - *avg, sum, min, max, range, count, first, last, stats, distinct, count_distinct*
- `aggregation.timeBucket` - time bucket for aggregation. The units here should be the same as used when adding data.

| Aggregation    | Description                                   |
|:---------------|:----------------------------------------------|
| first          | the first valid data value                    |
| last           | the last valid data value                     |
| min            | minimum data value                            |
| max            | maximum data value                            |
| avg            | mean of values in time range                  |
| count          | the number of data points                     |
| range          | the difference between the max and min values |
| sum            | the sum of values                             |
| distinct       | the list of unique values in the range        |
| distinct_count | the count of unique values in the range       |

Example

```javascript
const options = {
    aggregation: {
        type: 'avg',
        timeBucket: 5000
    }
};

const data = await client.range('temperature:3:32', 1548149180000, 1548149210000, options);
```

For `range` and `revrange`, each key will be aggregated as appropriate, subject to any supplied `LABELS`.
In this case, the query will return a pair of `[timestamp, object]` where the values of `object` are the aggregated
values for the appropriate keys in the given *min*/*max* range.

##### options.labels <a name="option-labels"></a>

The `labels` option may be specified to limit the fields returned from a query or available for aggregation. If this
option is specified, only the mentioned fields are returned from queries (opt-in).

```javascript
const options = {
    filter: 'temperature>=45',
    labels: ['name', 'lat', 'long']
}
const range = await client.range('temperatures', '-', '+',  options);
```

##### redact <a name="option-redact"></a>

`redact` is used to specify fields which should NOT be returned from a query or made available for aggregation. All
fields not explicitly specified are returned (opt-out)

```
const options = {
    filter: 'amount>=5000',
    redact: 'credit_card_number',
}
const range = await client.range('purchases', '-', '+',  options);
```

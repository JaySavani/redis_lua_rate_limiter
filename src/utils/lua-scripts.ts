export const SLIDING_WINDOW_LUA = `
  local current_time = tonumber(ARGV[1])
  local window_size = tonumber(ARGV[2])
  local max_requests = tonumber(ARGV[3])
  local requestId = ARGV[4]
  local key = KEYS[1]

  local window_start = current_time - window_size * 1000
  -- Remove timestamps older than the window
  redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

  -- Get current count of requests in window
  local current_count = redis.call('ZCARD', key)

  if current_count >= max_requests then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retry_after = 0
    if #oldest > 0 then
      retry_after = math.ceil((tonumber(oldest[2]) + (window_size * 1000) - current_time) / 1000)
    end
    return {0, current_count, retry_after}
  end

  redis.call('ZADD', key, current_time, requestId)
  
  -- Set expiry for the key and counter to window size + 1s buffer
  redis.call('PEXPIRE', key, window_size + 1000)
  
  return {1, current_count + 1, 0}
`;

export const TOKEN_BUCKET_LUA = `
  local key = KEYS[1]
  local current_time = tonumber(ARGV[1])
  local capacity = tonumber(ARGV[2])
  local refill_rate = tonumber(ARGV[3])

  local data = redis.call('HGETALL', key)
  local tokens = capacity
  local last_refill = current_time

  if #data > 0 then
    local fields = {}
    for i = 1, #data, 2 do
      fields[data[i]] = data[i + 1]
    end
    tokens = tonumber(fields['tokens']) or capacity
    last_refill = tonumber(fields['last_refill']) or current_time
  end

  local time_passed = current_time - last_refill
  local refill = time_passed * refill_rate
  tokens = math.min(capacity, tokens + refill)

  local allowed = 0
  local remaining = tokens

  if tokens >= 1 then
    tokens = tokens - 1
    remaining = tokens
    allowed = 1
  end

  redis.call('HSET', key, 'tokens', tostring(tokens), 'last_refill', tostring(current_time))

  -- Set TTL based on how long it takes to fully refill
  local ttl = math.ceil(capacity / refill_rate) + 1

  redis.call('EXPIRE', key, ttl)

  return {allowed, math.floor(remaining)}
`;

// local data = redis.call('HMGET', key, 'tokens', 'last_updated')
// local last_tokens = tonumber(data[1])
// local last_updated = tonumber(data[2])

// local current_tokens
// if last_tokens == nil then
//   -- Initial state: bucket starts full
//   current_tokens = capacity
// else
//   -- Calculate refill since last update
//   local time_passed_ms = math.max(0, current_time - last_updated)
//   local refill = time_passed_ms * refill_rate
//   current_tokens = math.min(capacity, last_tokens + refill)
// end

// if current_tokens >= 1 then
//   current_tokens = current_tokens - 1
//   redis.call('HMSET', key, 'tokens', current_tokens, 'last_updated', current_time)

//   -- Set TTL based on how long it takes to fully refill
//   local ttl = math.ceil(capacity / refill_rate) + 1000
//   redis.call('PEXPIRE', key, ttl)

//   return {1, math.floor(current_tokens)}
// else
//   return {0, 0}
// end

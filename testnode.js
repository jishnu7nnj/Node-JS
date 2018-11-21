const autocannon = require('autocannon')

autocannon({
  url: 'http://localhost:2971/getdata',
  connections: 10, //default
  pipelining: 1, // default
  duration: 10, // default
  method: 'POST',
  body: '{"order_id":1010,"location":"Pun","product_name":"L22","quantity":22}',
}, console.log)
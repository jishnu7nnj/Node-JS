var apiBenchmark = require('api-benchmark');

var service = {
    server1: "http://localhost:2971/"
  };

var routes = {
    trending: {
        method: 'post',
        route: '/getdata' ,
        headers: {
            'Accept': 'application/json'
        },
        body: {
            "order_id": 1010,
            "location": "Pun",
            "product_name": "L22",
            "quantity": 22
        }
    }};

apiBenchmark.measure(service, routes, function(err, results){
      console.log(results);
  });    
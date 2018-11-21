var express = require('express');
var app = express();
var Request = require('request');
var http = require('http');
var bodyParser = require('body-parser');
var querystring= require('querystring');
require('dotenv').config();

app.use(bodyParser.json());


var port = process.env.PORT || 2971; //setting up the port
var server = http.createServer(app) //creating the server
server.listen(port, function(){
    console.log('Listening. . .')
});


app.post('/getdata', function(req, res){
    console.log(req.body);
        postdata(req.body);
        put(req.body);
        deletedata(req.body);
        getdata(req.body);
        res.sendStatus(200);
        console.log(process.env.API_URL1);
        console.log(process.env.API_URL2);
        console.log(process.env.API_URL3);
        console.log(process.env.API_URL4);
   });

function postdata(body){
    Request.post({
        "headers": {
            "content-type": "application/json"
        },
        "url": process.env.API_URL1,
        "body": JSON.stringify(body)
    });
}

function deletedata(body){
    Request.delete({
        "headers": {
            "content-type": "application/json"
        },
        "url": process.env.API_URL3,
        "body": JSON.stringify(body)
    })
}

function put(body){
    console.log(body);
    body.quantity = 100;
    console.log(body);
    for (let key in body) {
        body["order_id"]=4;
        console.log(body[key]);
      }
        Request.put({
        "headers": {
            "content-type": "application/json"
        },
        "url": process.env.API_URL2,
        "body": JSON.stringify(body)
   });
}

function getdata(body){
    Request({
        "headers": {
            "content-type": "application/json"
        },
        "url": process.env.API_URL4,
        method: 'GET'
    },(error, response, body) => {
        if(error){
            res.status(404).send({msg : err});
        }
        else{
            console.log(response.body);
        };
    });
};
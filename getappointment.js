if (process.env.dynatrace_enabled) {
    try {
        require(process.env.dynatrace_file_path)({
            server: process.env.dynatrace_server,
            agentName: process.env.dynatrace_agent_name
        });
    } catch (err) {
        console.log(`Dynatrace Setup Failed: ${JSON.stringify({
            error: err.toString(),
            filePath: process.env.dynatrace_file_path,
            server: process.env.dynatrace_server,
            agentName: process.env.dynatrace_agent_name
        })}`);
    }
}

const cluster = require('cluster');
const os = require('os');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const http = require('http');
const Request = require("request");
const dateFormat = require('dateformat');
const _ = require('underscore');
const assert = require('assert');
const moment = require('moment');
const logger = require('./../../config/WinstonLogger/logger.js');
const terminus = require('@godaddy/terminus');
const Uuid = require('cassandra-driver').types.Uuid;
// for number of request
var count = 0;

const contactPoints = process.env.CASSANDRA_CONTACT_POINTS.split(',');
const authInfo = process.env.CASSANDRA_AUTH.split(',');

const cassandra = require('cassandra-driver');
const client = new cassandra.Client({
    contactPoints: contactPoints,
    authProvider: new cassandra.auth.PlainTextAuthProvider(authInfo[0], authInfo[1]),
    keyspace: process.env.CASSANDRA_KEYSPACE,
    encoding: {
        map: Map,
        set: Set,
        useUndefinedAsUnset: false
    },
    socketOptions: {
        readTimeout: 0,
        connectTimeout: 15000
    },
    pooling: {
        coreConnectionsPerHost: {
            [cassandra.types.distance.local]: 2,
            [cassandra.types.distance.remote]: 2,
        },
        maxRequestsPerConnection: 4096
    }
});
// use port 2980 unless there exists a preconfigured port
const port = process.env.PORT || 2980;
logger.debug(`Started GetAppointment microservice worker: ${cluster.worker.id} with process id: ${process.pid} on ${os.hostname()}:${port}`);

app.use(bodyParser.json());
app.use(logErrors);
// app.use(errorHandler);

function logErrors (err, req, res, next) {
    console.error("GetAppointment "+err.stack)
    next(err)
  };

// function errorHandler (err, req, res, next) {
//     res.status(500)
//     res.render('error', { error: err })
//   };

const server = app.listen(port);

// this function is called when you want the server to die gracefully
// i.e. wait for existing connections
const gracefulShutdown = function () {
    console.log(`Received kill signal for process id: ${process.pid}, shutting down gracefully.`);

    // Close Cassandra Client gracefully if possible
    client.shutdown();

    server.close(function () {
        console.log("Closed out remaining connections.");
        process.exit()
    });
    setTimeout(function () {
        console.error("Could not close connections in time, forcefully shutting down");
        process.exit()
    }, 300 * 1000);
}

// listen for TERM signal .e.g. kill 
process.on('SIGTERM', gracefulShutdown);

// listen for INT signal e.g. Ctrl-C
process.on('SIGINT', gracefulShutdown);

const jsonParser = bodyParser.json({
    type: 'application/*+json'
});

//Health check for GetAppointment microservice
async function onHealthCheck() {
    logger.info("GetAppointment microservice is up...");
}

terminus(server, {
    healthChecks: {
        '/healthcheck': onHealthCheck,
    }
});

// Health check for Get-Appointment Stack
app.get('/GetApptHealth', function (req, res) {
    logger.info("Health check requested for Get-Appointment Stack");
    logger.info("GetAppointment microservice is up...");
    const options = {method: 'GET', url: 'http://localhost:' + process.env.CD_PORT + '/healthcheck'};
    Request(options, function (error, response, body) {
        if (error) {
            logger.info("CalculateDuration microservice is down... " + error);
            return res.sendStatus(500);
        }
        logger.info("Printing health check response...");
        logger.info(JSON.stringify(response));
        if (response.statusCode === 200 || body.status === 'ok') {
            const options = {method: 'GET', url: 'http://localhost:' + process.env.CA_PORT + '/healthcheck'};
            Request(options, function (error, response, body) {
                if (error) {
                    logger.info("CalculateAvailability microservice is down... " + error);
                    return res.sendStatus(500);
                }
                if (response.statusCode === 200 || body.status === 'ok') {
                    const options = {method: 'GET', url: 'http://localhost:' + process.env.LC_PORT + '/healthcheck'};
                    Request(options, function (error, response, body) {
                        if (error) {
                            logger.info("LookupCapacity microservice is down... " + error);
                            return res.sendStatus(500);
                        }
                        if (response.statusCode === 200 || body.status === 'ok') {
                            const options = {method: 'GET', url: 'http://localhost:' + process.env.LR_PORT + '/healthcheck'};
                            Request(options, function (error, response, body) {
                                if (error) {
                                    logger.info("GETAPPT LookupReservation microservice is down... " + error);
                                    return res.sendStatus(500);
                                } else {

                                    // Made it to the end, we're good
                                    return res.sendStatus(200);
                                }
                            });
                        }
                    });
                }
            });
        }
        //res.sendStatus(200); THIS IS BAD - the whole block will get here before the callbacks complete and attempt to set headers on a completed request
    });
});

// Receive Get Appointment Request and make basic checks and send response appropriately
app.post('/orders/:order_id/deliveries/appointments', jsonParser, function (request, response) {
   // Log the number of requests 
    requestCountLogs(1);
    const request_id = Uuid.random();
    const requestBodyObject = {};
    // Request body is empty
    if (!request || Object.keys(request.body).length === 0) {
        requestBodyObject.request_id = request_id;
        requestBodyObject.app_name = "getappointment";
        requestBodyObject.hostname = request.hostname;
        requestBodyObject.path = request.path;
        requestBodyObject.msg = "GetAppointment request or request.body was empty";
        requestBodyObject.body = request.body;
        logger.error(JSON.stringify(requestBodyObject));
        logsToCassandra(JSON.stringify(requestBodyObject), 'eventlogging',request_id);
        return response.sendStatus(400);
    }

    if (!request.body.fulfill_loc || !request.body.delivery_address.latitude || !request.body.delivery_address.longitude || !request.body.resource_type) {
        // Check on required request parameters 
        requestBodyObject.request_id = request_id;
        requestBodyObject.app_name = "getappointment";
        requestBodyObject.hostname = request.hostname;
        requestBodyObject.path = request.path;
        requestBodyObject.msg = "GetAppointment request body does not contain required parameters";
        requestBodyObject.body = request.body;
        logger.error(JSON.stringify(requestBodyObject));
        logsToCassandra(JSON.stringify(requestBodyObject), 'eventlogging',request_id);
        return response.sendStatus(400);
    }

    if (request.body.start && request.body.end) {

        // Check on if start or end dates are in past
        const currDateTimeUTC = moment.utc(); // Object

        const startMomentAtOriginTZ = moment(request.body.start); // Object
        const endMomentAtOriginTZ = moment(request.body.end); // Object

        const startMomentAtUTC = moment.utc(request.body.start); // Object
        const endMomentAtUTC = moment.utc(request.body.end); // Object

        const startFormattedStr = startMomentAtUTC.format(); // String
        const endFormattedStr = endMomentAtUTC.format(); // String

        const requestStartUTCOffset = moment.parseZone(request.body.start).utcOffset(); // Number
        const requestEndUTCOffset = moment.parseZone(request.body.end).utcOffset(); // Number

        if(requestStartUTCOffset !== requestEndUTCOffset) {

            // Ensure the request start and end are in the same timezone offset from UTC
            return response.sendStatus(400);
        }

        if (startMomentAtUTC.isBefore(currDateTimeUTC) && endMomentAtUTC.isBefore(currDateTimeUTC)) {
            requestBodyObject.request_id = request_id;
            requestBodyObject.app_name = "getappointment";
            requestBodyObject.hostname = request.hostname;
            requestBodyObject.path = request.path;
            requestBodyObject.msg = "GetAppointment requested for past dates";
            requestBodyObject.body = request.body;
            logger.error(JSON.stringify(requestBodyObject));
            logsToCassandra(JSON.stringify(requestBodyObject), 'eventlogging',request_id);
            return response.sendStatus(400);
        }
        if (endMomentAtUTC.isSameOrAfter(currDateTimeUTC)) {

            const exec_start = new Date();
            const order_id = request.params.order_id;
            const fulfill_loc = request.body.fulfill_loc;
            const destination_latitude = request.body.delivery_address.latitude;
            const destination_longitude = request.body.delivery_address.longitude;
            const resource_type = request.body.resource_type;
            const requestBody = request.body;
            requestBodyObject.request_id = request_id;
            requestBodyObject.app_name = "getappointment";
            requestBodyObject.hostname = request.hostname;
            requestBodyObject.path = request.path;
            requestBodyObject.msg = "GetAppointment Request: " + request_id;
            requestBodyObject.body = request.body;
            logger.info(JSON.stringify(requestBodyObject));
            logsToCassandra(JSON.stringify(requestBodyObject), 'eventlogging',request_id);

            // Call CalculateDuration microservice
            getTraveltime(fulfill_loc, destination_latitude, destination_longitude, request_id, response, function (travelDuration) {

                // travelDuration should never be null as it defaults to 35 min

                // Call LookupReservation microservice
                lookupSoftReservation(fulfill_loc, resource_type, request_id, response, function (data) {

                    // Call LookupCapacity microservice
                    lookupCapacity(requestBody, data, order_id, travelDuration, request_id, response, function (slotResponse) {
                        // if there is no available slots from lookup capacity microservice
                        var slotResponseArrayLength = JSON.parse(slotResponse).length;
                        if(slotResponseArrayLength == 0 ){
                            response.status(201);
                            response.setHeader("Content-Type", "application/json");
                            response.send(slotResponse);
                        }else{ 
                        const exec_end = new Date();
                        const end = exec_end - exec_start;
                        const monitor_response_times = {
                            'request_id': request_id,
                            'exec_start': exec_start,
                            'exec_end': exec_end,
                            'exec_time': end,
                            'service_name': 'getappointment'
                        };
                        logger.info(JSON.stringify(monitor_response_times));
                        logsToCassandra(monitor_response_times, 'monitor_response_times',request_id);
                        response.status(201);
                        response.setHeader("Content-Type", "application/json");
                        response.send(slotResponse);
                    }  
                    });
                });
            });
        } else {
            response.sendStatus(500);
        }
    } else {
        requestBodyObject.app_name = "getappointment";
        requestBodyObject.hostname = request.hostname;
        requestBodyObject.path = request.path;
        requestBodyObject.msg = "GetAppointment request: start and end are required properties";
        requestBodyObject.body = request.body;
        logger.error(JSON.stringify(requestBodyObject));
        logsToCassandra(JSON.stringify(requestBodyObject), 'eventlogging',request_id);
        response.sendStatus(400);
    }
});

/*
Get the travel time between the store location and destination location
*/
function getTraveltime(fulfill_loc, destination_latitude, destination_longitude, request_id, response, callback) {

    const exec_start = new Date();
    const calcDurationReqObj = {
        host: 'localhost',
        port: process.env.CD_PORT,
        path: '/calculateduration/' + fulfill_loc + '/' + destination_latitude + '/' + destination_longitude +'/' + request_id,
        method: 'GET'
    };

    const calcDurationRespObj = {};
    const requestBodyObject = {};

    requestBodyObject.request_id = request_id;
    requestBodyObject.app_name = "getappointment";
    requestBodyObject.hostname = calcDurationReqObj.hostname;
    requestBodyObject.path = calcDurationReqObj.path;
    requestBodyObject.msg = "Sending request to CalculateDuration microservice";
    requestBodyObject.body = "";
    logger.info(JSON.stringify(requestBodyObject));

    // do the GET request for travel time from CalculateDuration microservice
    const getRequest = http.request(calcDurationReqObj, function (res) {

        if (res.statusCode === 400) {
            response.status(400);
            response.send("Origin Fulfillment Location Not Found");
        } else if (res.statusCode === 500) {
            response.status(500);
            response.send("Error in accessing Store Location table");
        } else if (res.statusCode === 501) {
            response.status(500);
            response.send("Error in accessing Travel Duration table");
        } else {

            let travelduration = parseInt(35);

            res.on('data', function (durationTime) {
                const exec_end = new Date();
                const end = exec_end - exec_start;
                const monitor_response_times = {
                    'request_id': request_id,
                    'exec_start': exec_start,
                    'exec_end': exec_end,
                    'exec_time': end,
                    'service_name': 'calculateduration'
                };
                logsToCassandra(monitor_response_times, 'monitor_response_times',request_id);
                travelduration += parseInt(durationTime);
                const traveltime = parseInt(travelduration);
                calcDurationRespObj.request_id = request_id;
                calcDurationRespObj.app_name = "getappointment";
                calcDurationRespObj.msg = "Received response from CalculateDuration microservice";
                calcDurationRespObj.body = "Travel Time: " + traveltime;
                logger.info(JSON.stringify(calcDurationRespObj));
                callback(traveltime);

            });

            res.on('error', function (error) {
                logger.error(`FOR request_id ${request_id} GET REQUEST CALCULATEDURATION RESPONSE ERROR ` + JSON.stringify(error));                

            });
        }
    });
    getRequest.on('error', function (error) {
        logger.error(`FOR request_id ${request_id} GET REQUEST CALCULATEDURATION ERROR ` + JSON.stringify(error));
        logger.error(`FOR request_id ${request_id}  CALCULATEDURATION error stack `+error.stack);
    });

    getRequest.on('socket', function(socket) {
        socket.on('error', function (error) {
            logger.error(`FOR request_id ${request_id} GET REQUEST CALCULATEDURATION SOCKET ERROR ` + JSON.stringify(error));
            logger.error(`FOR request_id ${request_id}  CALCULATEDURATION error stack `+error.stack);
            //reject(error);
            //req.abort();
        });
    });
    getRequest.end();
};

/*
Get details for all the capacity information using LookupCapacity microservice
*/

function lookupCapacity(requestBody, data, order_id, traveltime, request_id, response, callback) {

    const exec_start = new Date();
    const lookupCapacityReqObj = {};
    const lookupCapacityRespObj = {};
    const getAppointmentResponse = {};
    lookupCapacityReqObj.request_id = request_id;
    lookupCapacityReqObj.app_name = "getappointment";
    lookupCapacityReqObj.hostname = "localhost";
    lookupCapacityReqObj.path = "/lookupcapacity/" + traveltime+"/"+request_id;
    lookupCapacityReqObj.msg = "Sending request to LookupCapacity microservice";
    lookupCapacityReqObj.body = requestBody;
    logger.info(JSON.stringify(lookupCapacityReqObj));

    // do the POST request to fetch available capacity information
    Request.post({
        "headers": {
            "content-type": "application/json"
        },
        "url": "http://localhost:" + process.env.LC_PORT + "/lookupcapacity/" + traveltime+"/"+request_id,
        "body": JSON.stringify(requestBody)
    }, (error, res) => {
        
        lookupCapacityRespObj.request_id = request_id;
        lookupCapacityRespObj.app_name = "getappointment";
        lookupCapacityRespObj.path = "/lookupcapacity/" + traveltime;
        lookupCapacityRespObj.msg = "Received response from LookupCapacity microservice";

        if (error) {
            lookupCapacityRespObj.request_id = request_id;
            lookupCapacityRespObj.body = error;
            logger.error(JSON.stringify(lookupCapacityRespObj));
            logsToCassandra(JSON.stringify(lookupCapacityRespObj), 'eventlogging',request_id);
            return response.sendStatus(500);
        }

        if(!res || res.statusCode === 500) {
            // No response received
            lookupCapacityRespObj.request_id = request_id;
            lookupCapacityRespObj.body = !res ? "" : res.statusCode;
            logger.error(JSON.stringify(lookupCapacityRespObj));
            response.sendStatus(500);

        } else {

            const exec_end = new Date();
            const end = exec_end - exec_start;
            const responseBody = res.body;

            const monitor_response_times = {
                'request_id': request_id,
                'exec_start': exec_start,
                'exec_end': exec_end,
                'exec_time': end,
                'service_name': 'lookupcapacity'
            };

            logsToCassandra(monitor_response_times, 'monitor_response_times',request_id);

            //Check if the response from lookup capacity is empty or not if empty send zero as callback
            var capacitySlotArrayLength = JSON.parse(responseBody).length;
            if(capacitySlotArrayLength == 0){
                callback(responseBody);
            }else{
            //Get details to find true available capacity after removing any promised reservation from the capacity retrieved from LookupCapacity microservice
            calculateAvailability(responseBody, data, traveltime, request_id, response, function (slotData) {
                const responseObject = {};
                responseObject.slotdetails = slotData;
                const target = _.extend(requestBody, responseObject);
                //Call to insert all the open slots generated for a request
                insertSlotDetails(target, order_id, traveltime, request_id);
                getAppointmentResponse.request_id = request_id;
                getAppointmentResponse.app_name = "getappointment";
                getAppointmentResponse.msg = "Received response from GetAppointment microservice";
                getAppointmentResponse.body = JSON.parse(slotData);
                logger.info(JSON.stringify(getAppointmentResponse));
                logsToCassandra(JSON.stringify(getAppointmentResponse), 'eventlogging',request_id);
                callback(slotData);
            });
        }
        }
    });
}

/*
Get details for all the soft reserved slots using LookupReservation microservice
*/
const lookupSoftReservation = function (fulfill_loc, resource_type, request_id, response, callback) {

    const exec_start = new Date();
    const lookupReservationReqObj = {
        host: 'localhost',
        port: process.env.LR_PORT,
        path: '/lookupreservation/' + fulfill_loc + '/' + encodeURIComponent(resource_type) +'/'+request_id,
        method: 'GET'
    };

    const lookupReservationRespObj = {};
    const requestBodyObject = {};

    requestBodyObject.request_id = request_id;
    requestBodyObject.app_name = "getappointment";
    requestBodyObject.hostname = lookupReservationReqObj.hostname;
    requestBodyObject.path = decodeURIComponent(lookupReservationReqObj.path);
    requestBodyObject.msg = "Sending request to LookupReservation microservice";
    requestBodyObject.body = "";
    logger.info(JSON.stringify(requestBodyObject));

    // do the GET request to get reservation and duration information from LookupReservation microservice
    const getRequest = http.request(lookupReservationReqObj, function (res) {

        if (res.statusCode === 500) {
            response.status(500);
            response.send("Error in accessing Soft Reservation table");
        } else {
            res.on('data', function (RespObj) {

                const exec_end = new Date();
                const end = exec_end - exec_start;
                const monitor_response_times = {
                    'request_id': request_id,
                    'exec_start': exec_start,
                    'exec_end': exec_end,
                    'exec_time': end,
                    'service_name': 'lookupreservation'
                };
                logsToCassandra(monitor_response_times, 'monitor_response_times',request_id);
                lookupReservationRespObj.request_id = request_id;
                lookupReservationRespObj.app_name = "getappointment";
                lookupReservationRespObj.msg = "Received response from LookupReservation microservice";
                lookupReservationRespObj.body = JSON.parse(RespObj);
                logger.info(JSON.stringify(lookupReservationRespObj));
                callback(RespObj);

            });

            res.on('error', function (error) {
                logger.error(`FOR request_id ${request_id} GET REQUEST LOOKUPRESERVATION RESPONSE ERROR ` + JSON.stringify(error));                

            });
        }
    });
    getRequest.on('error', function (error) {
        logger.error(`FOR request_id ${request_id} GET REQUEST LOOKUPRESERVATION ERROR ` + JSON.stringify(error));
        logger.error(`FOR request_id ${request_id} GET REQUEST LOOKUPRESERVATION ERROR STACK `+error.stack);
    });
    getRequest.on('socket', function(socket) {
        socket.on('error', function (error) {
            logger.error(`FOR request_id ${request_id} GET REQUEST LOOKUPRESERVATION SOCKET ERROR ` + JSON.stringify(error));
            logger.error(`FOR request_id ${request_id} GET REQUEST LOOKUPRESERVATION ERROR `+error.stack);
            //reject(error);
            //req.abort();
        });
    });
    getRequest.end();
};

//Remove the slots which are already soft reserved and 
//availability for those slots in capacity is less than the
//travel time + duration(if that slot status is confirmed) from reservation table for that slot date
function calculateAvailability(capacityAvailableSlots, softReservedData, timeToDeliver, request_id, response, callback) {

    const exec_start = new Date();

    const object = {};
    const calcAvailabilityReqObj = {};
    const calcAvailabilityRespObj = {};
    object.capacitySlots = JSON.parse(capacityAvailableSlots);
    object.softReservationSlots = JSON.parse(softReservedData);

    calcAvailabilityReqObj.request_id = request_id;
    calcAvailabilityReqObj.app_name = "getappointment";
    calcAvailabilityReqObj.path = "/calculateavailability/" + timeToDeliver+"/"+request_id;
    calcAvailabilityReqObj.msg = "Sending request to CalculateAvailability microservice";
    calcAvailabilityReqObj.body = object;
    logger.info(JSON.stringify(calcAvailabilityReqObj));

    Request.post({
        "headers": {
            "content-type": "application/json"
        },
        "url": "http://localhost:" + process.env.CA_PORT + "/calculateavailability/" + timeToDeliver+"/"+request_id,
        "body": JSON.stringify(object)
    }, (error, res) => {
        calcAvailabilityRespObj.request_id = request_id;
        calcAvailabilityRespObj.app_name = "getappointment";
        calcAvailabilityRespObj.path = "/calculateavailability/" + timeToDeliver;

        if (error) {

            calcAvailabilityRespObj.msg = "Received ERROR response while calling CalculateAvailability microservice";
            calcAvailabilityRespObj.body = error;
            logger.error(JSON.stringify(calcAvailabilityRespObj));
            //implicit return here

        } else if (res) {

            // Response object exists

            if (!res.body) {

                calcAvailabilityRespObj.msg = "Received no response data in response from CalculateAvailability microservice";
                calcAvailabilityRespObj.body = "";
                logger.debug(JSON.stringify(calcAvailabilityRespObj));
                response.sendStatus(404);

            } else {

                // res.body obj has contents

                const exec_end = new Date();
                const end = exec_end - exec_start;
                const monitor_response_times = {
                    'request_id': request_id,
                    'exec_start': exec_start,
                    'exec_end': exec_end,
                    'exec_time': end,
                    'service_name': 'calculateavailability'
                };
                logsToCassandra(monitor_response_times, 'monitor_response_times',request_id);

                calcAvailabilityRespObj.msg = "Received response from CalculateAvailability microservice";
                calcAvailabilityRespObj.body = JSON.parse(res.body);
                logger.info(JSON.stringify(calcAvailabilityRespObj));
                callback(res.body);
            }

        } else {

            // No response
            calcAvailabilityRespObj.msg = "No response received from CalculateAvailability microservice";
            calcAvailabilityRespObj.body = "";
            logger.debug(JSON.stringify(calcAvailabilityRespObj));
            response.sendStatus(404);
        }
    });
}

// Function that will insert generated slot details for a request in soft_reservation group of tables
const insertSlotDetails = function (requestBody, order_id, timeToDeliver, request_id) {

    const fulfill_loc = requestBody.fulfill_loc;
    const delivery_address = requestBody.delivery_address;
    const resource_type = requestBody.resource_type;
    const mode = requestBody.mode;
    const item = requestBody.items;
    const start = requestBody.start;
    const end = requestBody.end;
    const result = requestBody.slotdetails;
    const parseResult = JSON.parse(result);

    const slotDetailArray = [];
    const itemsObj = new Map();
    const itemObj = new Map();
    const loggerObj = {};

    for (let x in parseResult) {
        slotDetailArray.push(parseResult[x]);
    }

    // Build the Items map
    for (let i = 0; i < requestBody.items.length; ++i) {
        itemObj.set("model_number", requestBody.items[i].model_number);
        itemObj.set("item_type", requestBody.items[i].item_type);
        if (requestBody.items[i].weight !== null) {
            itemObj.set("weight", requestBody.items[i].weight.toString());
        }
        if (requestBody.items[i].quantity !== null) {
            itemObj.set("quantity", requestBody.items[i].quantity.toString());
        }
        itemsObj.set(item[i].item_number, itemObj);
    }

    // Maintain all the GetAppointment requests in requests table
    const requestQuery = "Insert into requests (request_id ,get_appointment_request_start,get_appointment_request_end,mode,order_id,resource_type,fulfill_loc,delivery_address,items) values (?,?,?,?,?,?,?,?,?)";
    client.execute(requestQuery, [request_id, start, end, mode, order_id, resource_type, fulfill_loc, delivery_address, itemsObj], {
        prepare: true
    }, function (error, results) {
        if (error) {
            logger.error(`For request_id ${request_id} `+JSON.stringify(error));
        }
    });

    const SELLING_CHANNEL_TTL_BUFFER = process.env.DEFAULT_TTL_BUFFER;

    for (let j = 0; j < slotDetailArray.length; j++) {

        const slot_id = slotDetailArray[j].slot_id;
        const slot_start = slotDetailArray[j].slot_start;
        const slot_end = slotDetailArray[j].slot_end;
        const status = slotDetailArray[j].status;

        // Batch insert into soft_reservation group of tables
        const reservationQueries = [
            {
                query: 'INSERT INTO slots (request_id, slot_id, slot_start, slot_end, status) VALUES (?,?,?,?,?)',// USING TTL ' + SELLING_CHANNEL_TTL_BUFFER,
                params: [request_id, slot_id, slot_start, slot_end, status]
            },
            {
                query: 'INSERT INTO slots_by_request_and_status (request_id, slot_id, status, fulfill_loc, resource_type, slot_start, slot_end, duration) VALUES (?,?,?,?,?,?,?,?)',// USING TTL ' + SELLING_CHANNEL_TTL_BUFFER,
                params: [request_id, slot_id, status, fulfill_loc, resource_type, slot_start, slot_end, timeToDeliver]
            },
            {
                query: 'INSERT INTO request_by_slots_and_status (request_id, slot_id ,status, fulfill_loc, resource_type) VALUES (?,?,?,?,?)',// USING TTL ' + SELLING_CHANNEL_TTL_BUFFER,
                params: [request_id, slot_id, status, fulfill_loc, resource_type]
            }
        ];
        //const reservationQuerieOptions = { prepare: true, consistency: cassandra.types.consistencies.quorum };
        const reservationQueriesOptions = {prepare: true};
        client.batch(reservationQueries, reservationQueriesOptions, function (error) {

            assert.ifError(error);
            loggerObj.app_name = "getappointment";
            loggerObj.msg = `For request_id ${request_id} Available day slot (${slot_id}) for the request ${request_id} has been inserted in EDC with open status`;
            // logger.debug(JSON.stringify(loggerObj));
        });
    }
};

/* Insert event details into event_logging and 
response time details into monitor_response_times tables
*/
function logsToCassandra(log, log_type,request_id) {
    if (log_type === 'monitor_response_times') {
        const respTimeQuery = "INSERT INTO monitor_response_times(request_id,app_name,service_name,exec_end,exec_start,exec_time) VALUES (?,?,?,?,?,?)";
        const respTimeQueryParams = [log.request_id, 'GetAppointment', log.service_name, dateFormat(log.exec_end, "yyyy-mm-dd h:MM:ss.l"), dateFormat(log.exec_start, "yyyy-mm-dd h:MM:ss.l"), log.exec_time];
        client.execute(respTimeQuery, respTimeQueryParams, {prepare: true})
            .then(() => {
                logger.info(`For request_id ${request_id} Response Time Information inserted successfully: ` + respTimeQuery + " with params " + respTimeQueryParams);
            }).catch(err => {
            logger.error(`For request_id ${request_id} Received an error while attempting to log monitoring response times to Cassandra: ` + JSON.stringify(err));
        });
    } else {
        const eventLoggingQuery = "INSERT INTO event_logging (service_name,message,create_ts,event_id) VALUES(?,?,?,?)";
        const eventLoggingQueryParams = ['getappointment', log, dateFormat(new Date(), "yyyy-mm-dd h:MM:ss"), Uuid.random()];

        client.execute(eventLoggingQuery, eventLoggingQueryParams, {prepare: true})
            .then(() => {
                logger.info(`For request_id ${request_id} Event inserted successfully: ` + eventLoggingQuery + " with params " + eventLoggingQueryParams);
            }).catch(err => {
            logger.error(`For request_id ${request_id} Received an error while attempting to log to cassandra: ` + JSON.stringify(err));
        });
    }
}

function requestCountLogs(requestNo) {
    const requestCountObject = {};
    count = count+requestNo;
    if(count == process.env.REQUEST_COUNT){      
        requestCountObject.ts = dateFormat(new Date(), "yyyy-mm-dd h:MM:ss");  
        requestCountObject.type = 'GetAppointment';
        requestCountObject.count = count;
        logger.info(JSON.stringify(requestCountObject));
        const countInsertionQuery = "INSERT INTO requestcount(time,count,type) VALUES (?,?,?)";
        const countInsertionQueryParams = [dateFormat(new Date(), "yyyy-mm-dd h:MM:ss.l"),count, 'GetAppointment'];

        client.execute(countInsertionQuery, countInsertionQueryParams, {prepare: true})
            .then(() => {
                logger.info("No of Request Information inserted successfully: " + countInsertionQuery + " with params " + countInsertionQueryParams);
            }).catch(err => {
            logger.error("Received an error while attempting to insert no of request to Cassandra: " + JSON.stringify(err));
        });
        count = 0;
    }
}

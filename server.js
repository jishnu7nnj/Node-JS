let grpc = require("grpc");
var protoLoader = require("@grpc/proto-loader");
 
const server = new grpc.Server();
const SERVER_ADDRESS = "0.0.0.0:5001";
 
//protobuf
let proto = grpc.loadPackageDefinition(
  protoLoader.loadSync("./chat.proto", {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  })
);
 
function join(call, callback) {
  console.log("Server started. . .");
}
 
// Receiving message from client
function send(call, callback) {
  console.log(call.request);
}
 
// Defining server with the methods and start it
server.addService(proto.MessageSender.Chat.service, { join: join, send: send });
 
server.bind(SERVER_ADDRESS, grpc.ServerCredentials.createInsecure());
 
server.start();
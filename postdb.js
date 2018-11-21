var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var http = require('http');
var oracledb = require('oracledb');

var port = process.env.PORT || 3000;

var server = http.createServer(app);
server.listen(port, function() {
    console.log('Listening. . . ')
});

app.use(bodyParser.json());

var conAtributes ={
    user          : "SYSTEM",
    password      : "oracle07",
    connectString : "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1521))(CONNECT_DATA=(SERVER=DEDICATED)(SERVICE_NAME=XE)))"
  }

  

  app.post('/user', function (req, res) {
    oracledb.getConnection(conAtributes, function (err, connection) {
        console.log("inside post");
      var query = "INSERT INTO table1 (department_id, department_name) VALUES ("+req.body.department_id+",'"+ req.body.department_name+"')";
      console.log(query);
        connection.execute(query),
            function (err, result) {
                if (err) {
                    console.error(err);
                } 
                else{
                    console.log("inside else");
                    res.send(result.rows)
                }
                connection.release(
                    function (err) {
                        if (err) {
                            console.error(err.message);
                        } else {
                            console.log("POST /user_profiles : Connection released");
                        }
                    });
            }
    });
});

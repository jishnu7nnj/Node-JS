var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var oracledb = require('oracledb');
const morgan = require('morgan');

app.use(morgan("combined"));

app.use(bodyParser.json());

 app.get("/user", function (req, res){
     console.log("Fetching data from table :");
     const connection = oracledb.getConnection(
        {
          user          : "SYSTEM",
          password      : "oracle07",
          connectString : "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=DESKTOP-U7G0CGC)(PORT=1521))(CONNECT_DATA=(SERVER=DEDICATED)(SERVICE_NAME=XE)))"
        })
        .then(function(conn) {
          return conn.execute(
            `SELECT department_id, department_name
             FROM table1`
          )
            .then(function(result) {
              console.log(result.rows);
              res.json(result.rows);
              return conn.close();
            })
            .catch(function(err) {
              console.error(err);
              return conn.close();
            });
        })
        .catch(function(err) {
          console.error(err);
        });
 });
 app.listen(3000, ()=>{
     console.log("Connected . . . ")
 })
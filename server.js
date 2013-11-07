var config = require('./config');
var express = require('express');
var http = require('http');
// var mysql = require("mysql"); 
var pg = require('pg'); 
var app = require('express')();
var server = require('http').createServer(app);
var port = process.env.PORT || 8080;
var io = require('socket.io').listen(server, { log: false });
var crypto = require('crypto');


// Create the connection. 
var conString = config.getConnectionString();

var client = new pg.Client(conString);
client.connect(function(err) {
	if(err) {
		return console.error('could not connect to postgres', err);
	}
	else {
		console.log('Connection to Postgres succsefully established.');
	}
});

server.listen(port, function() {
	console.log('Listening on:', port);
});

app.use(express.bodyParser());

app.configure(function(){
  app.use('/media', express.static(__dirname + '/media'));
  app.use(express.static(__dirname + '/public'));
});

// Heroku won't actually allow us to use WebSockets
// so we have to setup polling instead.
// https://devcenter.heroku.com/articles/using-socket-io-with-node-js-on-heroku
io.configure(function () {
  io.set("transports", ["xhr-polling"]);
  io.set("polling duration", 10);
});


/* --------------------

	Router

-------------------- */

// Get Letters
app.get('/api/letters/', function(req, res){
	res.send('This feautre is unavailable');
});

// Get Letters
app.get('/api/delete_all/', function(req, res){
	deleteAllLetters(function(data){
		// Parse into a json
		res.send("All Letters Deleted");
	});
});

// Insert Letter
app.post('/api/insert/', function(req, res){
	res.send('This feautre is unavailable');
});

app.get('/', function(req, res){
	res.sendfile('public/index.html');
});

/* --------------------

	Sockets

-------------------- */

io.sockets.on('connection', function (socket) {
	var ip_address = socket.handshake.address.address;
	console.log('Socket connection : ' + ip_address);
    var encrypted_ip_address = crypto.createHash('md5').update(ip_address).digest("hex");
    socket.emit('getIpAddress', encrypted_ip_address);

	socket.on('init',function(eia){
		console.log('init : ' + eia);
		getAllLetters(function(all_letters){
			socket.emit('getAllLetters', all_letters);
		});
		getAllUsers(function(all_users_array){
			socket.emit('getAllUsers', all_users_array);
		});
		getCurrentUser(eia, ip_address, function(user_array){
			socket.emit('getUser', user_array);
			io.sockets.emit('getNewUser', user_array);
		});
	});

	socket.on('inserLetter', function (letter) {
		insertLetter(letter, function(new_letter){
			// Emit Letter Before Mysql Query
			// Emit to all users
			io.sockets.emit('getNewLetter', new_letter);
		})
	});

	socket.on('deleteLetter', function (letter_id) {
		deleteLetter(letter_id, function(letter_id){
			// Emit Letter Before Mysql Query
			// Emit to all users
			io.sockets.emit('getDeletedLetter', letter_id);
		})
	});

});

/* --------------------

	MySql Functions

-------------------- */

function insertLetter(data, callback){
	var letter_query = {
		letter: data.letter, 
		user: data.user,
	}
	var query = client.query('INSERT INTO letters (letter, user_id) values ($1, $2) RETURNING id', 
		[letter_query.letter, letter_query.user], 
		function(err, result) {
		if(err){
			console.log("Database query Error: insertLetter");
			console.log(err);
		}
		query_response = {
			id : result.rows[0].id,
			letter: data.letter, 
			user_id: data.user,
		}
		callback(query_response);
	});
}

function getAllLetters(callback){
	var query = client.query('SELECT * FROM letters', function(err, result) {
		if(err){
			console.log("Database query Error: getAllLetters");
			console.log(err);
		}
		var new_dict = {}; 
		for(i in result.rows){
			new_dict[result.rows[i].id] = result.rows[i];
		}
		callback(new_dict);
	});
}

function getAllUsers(callback){
	var query = client.query('SELECT * FROM users', function(err, result) {
		if(err){
			console.log("Database query Error: getAllUsers");
			console.log(err);
		}
		var new_dict = {}; 
		for(i in result.rows){
			new_dict[result.rows[i].id] = result.rows[i];
		}
		callback(new_dict);
	});
}

function getCurrentUser(eia, ip_address, callback){
	// Get Ip Address
	// Encrypt IP address (Goes in the DB)

	/* Users
	| id         | int(11)      | NO   | PRI | NULL    | auto_increment |
	| color      | varchar(255) | YES  |     | NULL    |                |
	| ip_address | varchar(255) | YES  |     | NULL    |                |
	| location   | varchar(255) | YES  |     | NULL    |      
	*/

	console.log(' + Encrypted : ' + eia)
	client.query('SELECT * FROM users WHERE ip_address IN ($1)',[eia], function (err, result) { 
		if(err){
			console.log("Database query Error: get getCurrentUser");
			console.log(err);
		}
		if(result && result.rows && result.rows.length > 0){
			callback(result.rows[0]);
		}
		else {
			// Get Location
			var location = get_location('api.hostip.info', '/get_json.php?ip=' + ip_address, function(response){
				var responseLocation = response.city + ", " + response.country_code;
				var color = generateRandomHexColor();
				client.query('INSERT INTO users (color, ip_address, location) VALUES($1, $2, $3) RETURNING id', 
					[ color, eia, responseLocation ], function(err, result){
					if(err){
						console.log("Database query Error: get getCurrentUser - Insert New User");
						console.log(err);
					}
					var query_response = {
						id : result.rows[0].id,
						color : color, 
						location : responseLocation,
					}
					callback(query_response);
				});
			});
		}
	});
}

function deleteLetter(letter_id, callback){
	console.log('query the db: ' + letter_id)
	client.query('DELETE FROM letters where id = $1;',[letter_id], function (err, result) { 
		if(err){
			console.log("Database query Error: get getCurrentUser");
			console.log(err);
		}
		if(result.rowCount > 0){
			callback(letter_id);
		}
	});
}

function deleteAllLetters(callback){
	client.query('TRUNCATE TABLE letters;', function (err, result) { 
		callback(); 
	});
}

/* --------------------

	Utilities

-------------------- */

function get_location(host, path, this_calback){
	//The url we want is: 'www.random.org/integers/?num=1&min=1&max=10&col=1&base=10&format=plain&rnd=new'
	var options = {
		host: host,
		path: path,
	};

	callback = function(response) {
		var str = '';

		//another chunk of data has been recieved, so append it to `str`
		response.on('data', function (chunk) {
			str += chunk;
		});

		//the whole response has been recieved, so we just print it out here
		response.on('end', function () {
			this_calback(str);
		});
	}

	http.request(options, callback).end();
}

function generateRandomHexColor(){
	return '#'+ ('000000' + (Math.random()*0xFFFFFF<<0).toString(16)).slice(-6);
}
/*

Sniff out new letter vs old letters... 

Add Delete... 

Identify Users by css class... Attribute

Styling...

*/

$(document).ready(function(){

	var this_user, all_users, eia, all_letters;

	if(document.domain == 'localhost'){
		console.log('Connecting to localhost');
		var socket = io.connect('http://localhost:8080');
	}
	else {
		console.log('Connecting to http://162.243.58.104');
		var socket = io.connect('http://162.243.58.104');
	}

	/* --------------------

	Sockets

	-------------------- */

	socket.on('getIpAddress', function(encrypted_ip_address){
		console.log('Got Ip Address : ' + encrypted_ip_address);
		eia = encrypted_ip_address;
		console.log(' Emit Init');
		socket.emit('init', eia);
	});
	
	// On, init Get all Letter from Database
	socket.on('getAllLetters',function (data) {
		console.log('getAllLetters');
		console.log(data);
		all_letters = data;
		$('#letters').html('');
		for(i in all_letters){
			var html = '<div id="' + all_letters[i].id + '" class="letter user-' + all_letters[i].user + '">' + all_letters[i].letter + '</div>';
			$('#letters').append(html);
		}
	});

	// On Init, get Current User (from IP address)
	socket.on('getUser', function(user){
		this_user = user;
	});

	// On Get New Letter, Add The Letter
	socket.on('getNewLetter',function (data) {
		console.log('getNewLetter');
		console.log(data);
		all_letters[data.id] = data;
		$('#letters').append('<div id="letter-' + data.id + '" class="letter user-' + data.user + '">' + data.letter + '</div>');
	});

	// On Get New Letter, Add The Letter
	socket.on('getAllUsers',function (data) {
		console.log('users');
		console.log(data);
		all_users = data;
		for(i in all_users){
			apppendCssClass(data[i].id, data[i].color);
		}
	});

	socket.on('getDeletedLetter', function(letter_id){
		$("#letter-" + letter_id).remove();
	});

	/* --------------------

	Keypress bind

	-------------------- */

	$(document).keypress(function(e){
		console.log(e.keyCode);
		if(e.keyCode === 8) {
			console.log('DELETE KEY')
			deleteLastUserLetter();
			e.preventDefault();
			e.stopPropagation();
		}
		else {
			var letter = String.fromCharCode(e.keyCode);
			if(typeof(letter) == 'string' && letter != ''){
				socket.emit('inserLetter', { letter: letter, user: this_user.id });
			}
		}
		
	})

	/* --------------------

	Utilities

	-------------------- */

	function getRandomLetter(){
		var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
		return possible[parseInt(Math.random() * possible.length)];
	}

	function apppendCssClass(id, hex){

		console.log('apppendCssClass');
		console.log(hex);

		var style = document.createElement('style');
		style.type = 'text/css';
		/*
		border: solid 1px green;
		background: rgba(0, 128, 0, 0.2);
		text-shadow: 0px 0px 2px rgba(0, 128, 0, 0.5);
		color: green;
		*/

		if(hex.length == 7){
			// Remove first char
			hex = hex.substring(1);
		}

		var rgb = hexToRgb(hex);

		console.log('.user-' + id );
		style.innerHTML = '.user-' + id + ' { \
			color: #'+hex+';\
			background: rgba( ' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.2);\
			border-color: #'+ hex +'; \
			text-shadow: 0px 0px 2px rgba( ' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.5);\
		}';
		document.getElementsByTagName('head')[0].appendChild(style);
	}
	function hexToRgb(hex) {
		var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : null;
	}

	function deleteLastUserLetter(){
		// socket.emit('deleteLetter', this_user.id);
	}

});
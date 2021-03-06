/** @jsx React.DOM */
function Pong(){
	var self = this;
	this.gameLines = null;
	this.canvas = null;
	this.context = null;
	this.ball = null;
	this.down = false;
	this.downInterval = null;
	this.user = {
		pseudo: null,
		roomName: null
	};
	this.xValue = null;
	this.updateScores = null;

	this.initUI = function(){
		var LoginForm = React.createClass({
			render: function(){
				return (
					<div>
						<label for="username">{"UserName"}</label>{" : "}<input type="text" id="username" /><br />
						<label for="roomName">{"Room Name"}</label>{" : "}<input type="text" id="roomName" /><br />
						<input type="submit" id="submitAuth" />
					</div>
				);
			}
		});

		React.renderComponent(<LoginForm />, document.getElementById('login'));
	};

	this.initEvents = function(){
		var usernameInput = $('#username'),
			roomName = $('#roomName');
		var bothInputs = usernameInput.asEventStream('keydown').merge(roomName.asEventStream('keydown')),
		validate = bothInputs.filter(function(e){
			return e.keyCode === 13;
		}).merge($('#submitAuth').asEventStream('click')).filter(function(){
			return usernameInput.val().trim().length > 0 && roomName.val().trim().length > 0;
		});

		validate.onValue(function(){
			self.registerUser(usernameInput.val()).chain(function(){
				self.user.roomName = roomName.val().trim();
				self.initGameUI();
				initChat();
			});
		});
	};

	this.registerUser = function(val){
		this.user.pseudo = val.trim();
		return Promise.of();
	};

	this.initGameUI = function(){
		var Results = React.createClass({
			getInitialState: function(){
				return {
					left: {
						pseudo: null
					},
					right: {
						pseudo: null
					},
					gameInfos: {
						scores: {
							left: 0,
							right: 0
						}
					}
				};
			},
			componentDidMount: function(){
				var scores = this;
				self.updateScores = function(gameInfos){
					scores.setState(gameInfos);
				};
			},
			render: function(){
				return (
					<div className="results">
						<div classNam="results__left">
							{this.state.left.pseudo + ' ' + this.state.gameInfos.scores.left}
						</div>
						<div className="results__right">
							{this.state.right.pseudo + ' ' + this.state.gameInfos.scores.right}
						</div>
					</div>
				);
			}
		});
		var GamePlateform = React.createClass({
			render: function(){
				return (
					<div id="gamePlateform">
						<canvas width="700" height="500" id="pongCanvas">
							{ "Your browser don't support canvas, please chose one from : "}
							<a href="http://browsehappy.com/">"http://browsehappy.com/"</a>
						</canvas>
						<Results />
					</div>
				);
			}
		});
		React.renderComponent(<GamePlateform />, document.getElementById('pong'));
		$('#chat, #pong').css('display', 'block');
		$('#login').css('display', 'none');
		this.initCanvas();
		socket.joinGame({
			room: self.user.roomName,
			pseudo: self.user.pseudo
		});
	};

	this.clearCanvasProps = function(){
		if(this.canvas){
			this.context.clearRect(0, 0, self.canvas.width, self.canvas.height); // clean there because we'll lost focus on the old canvas object
		}
		this.canvas = null;
		this.context = null;
		this.gameLines = null;
		this.ball = null;
	};

	this.initCanvas = function(){
		this.clearCanvasProps();
		this.canvas = document.getElementById('pongCanvas');
		if(!this.canvas){
			alert('Can\'t get the canvas');
		}
		this.context = this.canvas.getContext('2d');
		if(!this.context){
			alert('Can\'t get canvas\'s context');
		}
		this.context.clearRect(0, 0, self.canvas.width, self.canvas.height);

		this.gameLines = {
			'left': new Line(10).init(self.user.pseudo),
			'right': new Line(self.canvas.width - 10).init(self.user.pseudo + '2')
		};
		this.wireLinesEvent();
	};

	this.spawnBall = function(){
		this.ball = new Ball();
	};

	this.createLine = function(pos){
		this.context.beginPath();
		this.context.moveTo(pos.fromLeft, pos.start);
		this.context.lineTo(pos.fromLeft, pos.stop);
		this.context.lineWidth = 5;
		this.context.stroke();
		this.context.closePath();
	};

	this.updateLines = function(status){
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		if(status === 'up'){
			var obj = this.gameLines['left'];
			obj.pos.start -= 20;
			obj.pos.stop -= 20;
			obj.update(status);
		} else if(status === 'down'){
			var obj = this.gameLines['left'];
			obj.pos.start += 20;
			obj.pos.stop += 20;
			obj.update(status);
		} else{
			_.each(this.gameLines, function(obj, key){
				obj.update();
			});
		}
		if(this.ball){
			this.ball.outUpdate();
		}
		if(status && (status === 'up' || status === 'down')){
			this.gameLines['right'].update();
			socket.updateLine(status);
		}
	};

	this.wireLinesEvent = function(){
		Bacon.fromEventTarget(document, 'keydown').onValue(function(e){
			if(self.down){
				return;
			}
			self.down = true;
			self.downInterval = setInterval(function(){
				if(e.keyCode === 40){
					self.updateLines('down');
				} else if(e.keyCode === 38){
					self.updateLines('up');
				}
			}, 50);
		});
		Bacon.fromEventTarget(document, 'keyup').onValue(function(e){
			if(!self.down){
				return;
			}
			self.down = false;
			clearInterval(self.downInterval);
			self.downInterval = null;
		});
	};

	this.updateChecks = function(obj){
		if(!obj.pos){
			return;
		}
		if(obj.pos.start < 0){
			return false;
		} else if(obj.pos.stop > this.canvas.height){
			return false;
		} else{
			return true;
		}
	};

	this.updateEnnemyLine = function(pos){
		this.gameLines['right'].pos.start = pos.start;
		this.gameLines['right'].pos.stop = pos.stop;
		this.updateLines();
	};

	this.endGame = function(looserPseudo){
		this.announceLooser(looserPseudo);
		this.playAgain();
	};

	this.playAgain = function(){
		if(confirm('Play again ?')){
			socket.playAgain(true);
		} else{
			socket.playAgain(false);
		}
	};

	this.announceLooser = function(pseudo){
		alert(pseudo + ' lost the game');
	};
	
	this.setPaddlePos = function(data){
		_.each(data, function(paddle){
			if(paddle){
				self.gameLines[paddle.paddle].initPaddlePos(paddle.pos);
			}
		});
	};

	this.init = function(){
		this.initUI();
		this.initEvents();
		return this;
	};

	function Line(){
		this.lineHeight = 100;
		this.pos = null;
		this.currentUpdate = null;
		this.pseudo = null;

		this.update = function(status){
			this.currentUpdate = status;
			if(!self.updateChecks(this) && this.currentUpdate){
				if(this.currentUpdate === 'up'){
					this.pos.start = 0;
					this.pos.stop = this.lineHeight;
				} else if(this.currentUpdate === 'down'){
					this.pos.start = self.canvas.height - this.lineHeight;
					this.pos.stop = self.canvas.height;
				}
				this.currentUpdate = null;
			}
			if(this.pos){
				self.createLine(this.pos);
			}
		};
		
		this.initPaddlePos = function(pos){
			this.pos = pos;
			self.createLine(this.pos);
		};

		this.init = function(pseudo){
			this.pseudo = pseudo;
			return this;
		};
	}

	function Ball(xValue){
		var ball = this;
		this.pos = {
			x: null,
			y: null
		};
		this.radius = null;

		this.update = function(pos){
			this.pos = pos;
			self.updateLines();
			this.createBall();
		};

		this.outUpdate = function(){
			this.createBall();
		};

		this.kill = function(player){
			clearInterval(ball.refreshInterval);
			socket.endGame();
		};
		
		this.setInfos = function(infos){
			this.pos.x = infos.pos.x;
			this.pos.y = infos.pos.y;
			this.radius = infos.radius;
		};
		
		this.createBall = function(){
			self.context.beginPath();
			self.context.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI*2);
			self.context.fill();
			self.context.closePath();
		};

		this.init = function(){
			this.createBall();
			return this;
		};
	}
}
$(document).ready(function(){
	window.pong = new Pong().init();
});

#!/usr/bin/node
var http = require("http");
var qstring = require("querystring");
var url = require("url");
var fs = require("fs");
var matchs = [], matchmeta = [], u2id = {}, id = 0, optbl = {};
function dropmatch(id){
	var match = matchs[id];
	if (match){
		if (u2id[match.master] == id){
			delete u2id[match.master];
			delete optbl[match.master];
		}
		if (u2id[match.slave] == id){
			delete u2id[match.slave];
			delete optbl[match.slave];
		}
		delete matchs[id];
		delete matchmeta[id];
	}
}
function encodeMatch(match){
	var ret = "errorcode=0";
	for(var key in match){
		ret+="&"+key+"="+match[key];
	}
	return ret;
}
function rpvp2(req, res, data){
	var match = matchs[data.id];
	if (match){
		var meta = matchmeta[data.id];
		if (!meta.closed){
			if (data.user == match.master){
				meta.mastersaw = true;
				if (meta.slavesaw){
					meta.closed = true;
					match.statu = "closed";
				}
			}else if (data.user == match.slave){
				meta.slavesaw = true;
				if (meta.mastersaw){
					meta.closed = true;
					match.statu = "closed";
				}
			}
		}
		res.writeHead("200");
		res.end(encodeMatch(match));
	}else{
		res.writeHead("503");
		res.end("");
	}
}
function kill(req, res, data){
	res.writeHead("200");
	res.end("errorcode=0");
	/*if (data.user && data.user in u2id){
		delete matchs[u2id[data.user]];
		delete u2id[data.user];
	}*/
}
function slaveduel(req, res, data){
	res.writeHead("200");
	console.log("SLAVEDUEL", data);
	var getop = optbl[data.user];
	if (getop && getop in u2id && u2id[getop] in matchs){
		var match = matchs[u2id[getop]];
		var seed = match.seed;
		delete match.seed;
		res.end(encodeMatch(match));
		match.seed = seed;
		if (match.masterescore){
			match.masterscore = match.masterescore;
			delete match.masterescore;
		}
	}else{
		res.end("errorcode=0&id=&master=&slave=&masterdeck=&masterelement=&masterescore=&masterwon=&masterlost=&slavedeck=&slaveelement=&slavescore=&slavewon=&slavelost=&mastermsg=&slavemsg=&masterctrl=&slavectrl=&statu=");
	}
}
function insertduel(req, res, data){
	// NB client calls this even if unnecessarily. Need to eventually clear optbl entries
	if (data.user in optbl){
		res.writeHead("200");
		res.end("errorcode=0");
		return;
	}
	var ourid = ++id;
	console.log(ourid, data);
	if (id > 2147483640)id=0;
	var match = matchs[ourid] = {id: ourid};
	match.seed = data.seed;
	match.master = data.user;
	match.slave = "";
	match.masterdeck = data.masterdeck;
	match.masterelement = data.masterelement;
	match.masterescore = data.masterscore;
	match.masterwon = data.masterwon;
	match.masterlost = data.masterlost;
	match.slavedeck = "";
	match.slaveelement = "";
	match.slavescore = "";
	match.slavewon = "";
	match.slavelost = "";
	match.mastermsg = "";
	match.slavemsg = "";
	match.masterctrl = "";
	match.slavectrl = "";
	match.statu = data.op;
	matchmeta[ourid] = {time: Date.now()};
	optbl[data.user] = data.op;
	optbl[data.op] = data.user;
	u2id[data.user] = ourid;
	u2id[data.op] = ourid;
	res.writeHead("200");
	res.end("errorcode=0&id="+ourid);
}
function insertslave(req, res, data){
	res.writeHead("200");
	res.end("errorcode=0");
	var match = matchs[data.id];
	if (match){
		match.slave = data.user;
		match.slavedeck = data.slavedeck;
		match.slaveelement = data.slaveelement;
		match.slavescore = data.slavescore;
		match.slavewon = data.slavewon;
		match.slavelost = data.slavelost;
		match.statu = data.statu;
	}
}
function writemaster(req, res, data){
	res.writeHead("200");
	res.end("errorcode=0");
	var match = matchs[data.id];
	if (match){
		match.mastermsg = data.mastermsg;
		match.masterctrl = data.masterctrl;
		match.statu = data.statu;
		if (match.statu == "masterleft"){
		}
	}
}
function writeslave(req, res, data){
	res.writeHead("200");
	res.end("errorcode=0");
	var match = matchs[data.id];
	if (match){
		match.slavemsg = data.slavemsg;
		match.slavectrl = data.slavectrl;
		match.statu = data.statu;
	}
}
function readrpvp2(req, res, data){
	if (data.id in matchs){
		res.writeHead("200");
		res.end(encodeMatch(matchs[data.id]));
	}else{
		res.writeHead("503");
		res.end();
	}
}
var routes = {};
[rpvp2, kill, slaveduel, insertduel, insertslave, writemaster, writeslave, readrpvp2].forEach(function(func){
	routes[func.name] = func;
});
http.createServer(function(req, res){
	for (var route in routes){
		if (~req.url.indexOf(route)){
			if (req.method == "POST"){
				console.log(req.url);
				var body = "";
				req.on("data", function(data) { body += data; });
				req.on("end", function(){
					routes[route](req, res, qstring.parse(body));
				});
			}else if (req.method == "GET"){
				console.log("get");
				routes[route](req, res, url.parse(req.url, true).query);
			}
			return;
		}
	}
	if (req.url == "/CustomRules.js"){
		fs.readFile(__dirname + "/CustomRules.js", function(err, data){
			res.writeHead("200");
			res.end(data);
		});
	}else{
		res.writeHead("200");
		res.end();
	}
}).listen(80);
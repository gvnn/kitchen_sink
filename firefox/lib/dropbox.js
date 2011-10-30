const simpleStorage = require("simple-storage").storage;
var windows = require("windows").browserWindows;
var tabs = require("tabs");

var dropbox = {

	setup: function(consumerKey, consumerSecret) {
		this._consumerKey = consumerKey;
		this._consumerSecret = consumerSecret;
		this._requestCounter = (new Date).getTime();
		this._request_token_url = "/oauth/request_token";
		this._authorize_url = "/oauth/authorize";
		this._access_token_url = "/oauth/access_token";
		this._request_module = require('request').Request;
		this._oauth = require('oauth').OAuth;
		this._userid = "";
	},
	
	authenticate : function() {
		console.log('opening connection: ' + this._request_token_url);
		this._request(this._request_token_url, {
			method : "POST",
			sendAuth: false,
			dataType: "text",
			success : function(data) {
				console.log("account info", data.text);
				res = dropbox._parse_querystring(data.text.split('&'));
				dropbox.set_accessTokenSecret(res['oauth_token_secret']);
				dropbox.set_accessToken(res['oauth_token']);
				
				//redirect to authentication
				url = dropbox._stringify(
					dropbox._oauth.getParameterMap({
						oauth_consumer_key: dropbox._consumerKey,
						oauth_token : dropbox.accessToken() 
						//no callback, firefox doesn't like redirects to resource://
						//oauth_callback : require("self").data.url('options.html') 
					}));
				
				console.log("open tab to:", 'https://www.dropbox.com/1' + dropbox._authorize_url + '?' + url);
				tabs.open('https://www.dropbox.com/1' + dropbox._authorize_url + '?' + url);
			},
			error: function(data) {
				console.log("account info error", data.text);
			}
		});
	},
	
	get_access_token : function() {
		this._request(this._access_token_url, {
			method : "GET",
			sendAuth: true,
			dataType: "text",
			success: function(data) {
				console.log("get_access_token response: ", data.text);
				res = dropbox._parse_querystring(data.text.split('&'));
				dropbox.set_accessTokenSecret(res['oauth_token_secret']);
				dropbox.set_accessToken(res['oauth_token']);
				dropbox.set_userid(res['uid']);
			}
		});
	},
	
	remove_token : function() {
		this.set_accessTokenSecret("access_token", "");
		this.set_accessToken("access_token_secret", "");
	},
	
	download : function() {
		_rq = this._request_module({
			url: "http://dl.dropbox.com/u/" + this.userid() + "/bookmarks.json",
			onComplete: function (response) {
				//check status code
				console.log(response.status);
				if(parseInt(response.status) == 200) {
					dropbox._overwrite_bookmarks(response.json);
				}
			}
		});
		_rq.get();
	},
	
	accessToken : function() {
		return simpleStorage.settings['access_token'];
	},
  
	accessTokenSecret : function() {
		return simpleStorage.settings['access_token_secret'];
	},
	
	userid : function() {
		return simpleStorage.settings['userid'];
	},
	
	set_userid : function(value) {
		simpleStorage.settings['userid'] = value;
		this._userid = value;
	},
	
	set_accessTokenSecret : function(value) {
		simpleStorage.settings['access_token_secret'] = value;
		this._accessTokenSecret = value;
	},
  
	set_accessToken : function(value) {
		simpleStorage.settings['access_token'] = value;
		this._accessToken = value;
	},
	
	_overwrite_bookmarks : function(jsonp) {
		var {Cc, Ci} = require("chrome");
		var bookmarksService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		//empty folders
		bookmarksService.removeFolderChildren(bookmarksService.bookmarksMenuFolder);
		bookmarksService.removeFolderChildren(bookmarksService.toolbarFolder);
		//add new items
		console.log("items: " + jsonp[0].children.length);
		for (var i=0; i < jsonp[0].children.length; i++) {
			console.log("children title: " + jsonp[0].children[i].title);
			if(jsonp[0].children[i].title == "Bookmarks bar") {
				this._add_bookmarks(bookmarksService.toolbarFolder, jsonp[0].children[i].children, bookmarksService, ioService);
			} else {
				this._add_bookmarks(bookmarksService.bookmarksMenuFolder, jsonp[0].children[i].children, bookmarksService, ioService);
			}
		}
	},
	
	_add_bookmarks : function(index, tree, service, io) {
		for (var i=0; i < tree.length; i++) {
			//check if it's a folder
			if(tree[i].children == undefined) {
				var uri = io.newURI(tree[i].url, null, null);
				//simple entry
				service.insertBookmark(index, uri, service.DEFAULT_INDEX, tree[i].title);
				console.log("added url: " + tree[i].url);
			} else {
				//add folder
				folder = service.createFolder(index, tree[i].title, service.DEFAULT_INDEX);
				console.log("created folder: " + tree[i].title);
				//folder
				this._add_bookmarks(folder, tree[i].children, service, io);
			}
		}
	},
	
	_stringify : function (parameters) {
		var params = [];
		for(var p in parameters) {
			params.push(encodeURIComponent(p) + '=' +
			encodeURIComponent(parameters[p]));
		}
		return params.join('&');
	},
	
	_extend : function() {
		target = arguments[0] || {}
		i = 1;
		for ( ; i < arguments.length; i++ ) {
			for(var p in arguments[i]) {
				target[p] = arguments[i][p];
			}
		}
		return target;
	},
	
	_parse_querystring : function(a) {
		if (a == "") return {};
		var b = {};
		for (var i = 0; i < a.length; ++i)
		{
			var p=a[i].split('=');
			if (p.length != 2) continue;
			b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
		}
		return b;
	},
	
	_request: function(path, params, data) {
		
		params = this._extend({}, {
			subdomain: "api",
			apiVersion: "1",
			sendAuth: true,
			type: 'none',
			dataType: "json"
		}, params || {});

		if (params.sendAuth && !this.accessToken()) {
			throw "Authenticated method called before authenticating";
		}

		var url = "https://" + params.subdomain + ".dropbox.com/" + params.apiVersion + path;

		var message = {
			action: url,
			method: params.method,
			parameters: {
				oauth_consumer_key: this._consumerKey,
				oauth_signature_method: "HMAC-SHA1"
			}
		};

		if(params.method == "GET") {
			this._extend(message.parameters, data);
		}
		
		if(params.type == "file") {
			this._extend(message.parameters, { file : data.file_name});
		}

		if (params.sendAuth) {
			message.parameters.oauth_token = this.accessToken();
		}

		var oauthBits = {
			consumerSecret: this._consumerSecret
		};

		if (params.sendAuth) {
			oauthBits.tokenSecret = this.accessTokenSecret();
		}

		this._oauth.setTimestampAndNonce(message);
		this._oauth.SignatureMethod.sign(message, oauthBits);
				
		_rq = this._request_module({
			url: message.action,
			content: this._stringify(this._oauth.getParameterMap(message.parameters)),
			onComplete: function (response) {
				//check status code
				console.log(response.status);
				switch(parseInt(response.status)) {
					case 200:
						params.success(response);
						break;
					default:
						params.error(response);
						break;
				}
			}
		});
		
		switch(params.method) {
			case "GET":
				_rq.get();
				break;
			case "POST":
				_rq.post();
				break;
		}
	}
}

exports.dropbox = dropbox;
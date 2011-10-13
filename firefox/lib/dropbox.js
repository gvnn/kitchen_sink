const simpleStorage = require("simple-storage").storage;

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
	},
	
	authenticate : function() {		
		console.log('opening connection: ' + this._request_token_url);
		this._request(this._request_token_url, {
			method : "POST",
			sendAuth: false,
			dataType: "text"
		});
	},
	
	accessToken : function() {
		return simpleStorage.settings['access_token'];
	},
  
	accessTokenSecret : function() {
		return simpleStorage.settings['access_token_secret'];
	},
  
	set_accessTokenSecret : function(value) {
		simpleStorage.settings['access_token_secret'] = value;
		this._accessTokenSecret = value;
	},
  
	set_accessToken : function(value) {
		simpleStorage.settings['access_token'] = value;
		this._accessToken = value;
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
				console.log(response.text);
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
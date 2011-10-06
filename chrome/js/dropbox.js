var dropbox = {

	setup: function(consumerKey, consumerSecret) {
		this._consumerKey = consumerKey;
		this._consumerSecret = consumerSecret;
		this._requestCounter = $.now();
		this._request_token_url = "/oauth/request_token";
		this._authorize_url = "/oauth/authorize";
		this._access_token_url = "/oauth/access_token";
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
	
	authenticate : function() {
		this._request(this._request_token_url, {
			method : "GET",
			sendAuth: false,
			dataType: "text",
			success: function(data) {
				res = dropbox._parse_querystring(data.split('&'));
				dropbox.set_accessTokenSecret(res['oauth_token_secret']);
				dropbox.set_accessToken(res['oauth_token']);
				//redirect to authentication
				url = dropbox._stringify(
					OAuth.getParameterMap({
						oauth_consumer_key: dropbox._consumerKey,
						oauth_token : dropbox.accessToken(),
						oauth_callback : chrome.extension.getURL("options.html")
					}));
				top.window.location.href = 'https://www.dropbox.com/1' + dropbox._authorize_url + '?' + url;
			}
		});
	},
	
	get_access_token : function() {
		this._request(this._access_token_url, {
			method : "GET",
			sendAuth: true,
			dataType: "text",
			success: function(data) {
				res = dropbox._parse_querystring(data.split('&'));
				dropbox.set_accessTokenSecret(res['oauth_token_secret']);
				dropbox.set_accessToken(res['oauth_token']);
				chrome.extension.getBackgroundPage().dropbox = dropbox;
			}
		});
	},
  
	accessToken : function() {
		return settings.get_value("access_token", this._accessToken);
	},
  
	accessTokenSecret : function() {
		return settings.get_value("access_token_secret", this._accessTokenSecret);
	},
  
	set_accessTokenSecret : function(value) {
		this._accessTokenSecret = value;
		settings.set_value("access_token_secret", value);
	},
  
	set_accessToken : function(value) {
		settings.set_value("access_token", value);
		this._accessToken = value;
	},
	
	set_fs : function(value) {
		this._fs = value;
	},
	
	getInfo: function(callback) {
		this._request("/account/info", {
				method : "GET",
				successCallback : callback,
				success: function(data) {
					console.log("account info", data);
				},
				error: function() {
					console.log("account info error", arguments);
				}
			}
		);
	},
	
	sendFile : function(file_name, fileEntry) {	
		dropbox._request("/files/dropbox/public", {
			method : "POST",
			type : "file",
			subdomain : 'api-content'}, 
			{
				file_name : file_name,
				file : fileEntry
			}
		);
	},

	_stringify : function (parameters) {
		var params = [];
		for(var p in parameters) {
			params.push(encodeURIComponent(p) + '=' +
			encodeURIComponent(parameters[p]));
		}
		return params.join('&');
	},

	_request: function(path, params, data) {
		params = $.extend({}, {
			subdomain: "api",
			apiVersion: "1",
			sendAuth: true,
			success: $.noop,
			error: $.noop,
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
			$.extend(message.parameters, data);
		}
		
		if(params.type == "file") {
			$.extend(message.parameters, { file : data.file_name});
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

		OAuth.setTimestampAndNonce(message);
		OAuth.SignatureMethod.sign(message, oauthBits);
		
		if(params.type == "file") {
			_query_string = this._stringify(OAuth.getParameterMap(message.parameters));
			data.file.file(function(return_file){
				var formdata = new FormData();
				formdata.append("file", return_file);
				var req = new XMLHttpRequest();
				req.open("POST", url + '?' + _query_string);
				req.send(formdata);
				chrome.extension.getBackgroundPage().message('Upload complete');
			}, sync._fs_error_handler);
		} else {
			$.ajax({
				dataType: params.dataType,
				method: params.method,
				url: url,
				data: OAuth.getParameterMap(message.parameters),
				success: function(data) {
					params.success(data);
					if(params.successCallback) {
						params.successCallback(data);
					}
				},
				error: params.error
			});
		}
	}
};
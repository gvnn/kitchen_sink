var dropbox = {

	setup: function(consumerKey, consumerSecret) {
		this._consumerKey = consumerKey;
		this._consumerSecret = consumerSecret;
		this._requestCounter = $.now();
	},
  
	accessToken : function() {
		return this._accessToken;
	},
  
	accessTokenSecret : function() {
		return this._accessTokenSecret;
	},
  
	set_accessTokenSecret : function(value) {
		this._accessTokenSecret = value;
	},
  
	set_accessToken : function(value) {
		this._accessToken = value;
	},
	
	set_fs : function(value) {
		this._fs = value;
	},
	
	authenticate: function(email, password, callback) {
		var that = this;
		this._request("/token", {
				method : "GET",
				sendAuth: false,
				success: function(data) {
					console.log("authentication response", data);
					that._accessToken = data.token;
					that._accessTokenSecret = data.secret;
					if (callback) {
						callback();
					}
				},
				error: function() {
					console.error("authentication error", arguments);
				}
			}, {
				email: email,
				password: password
			}
		);
	},

	getInfo: function() {
		this._request("/account/info", {
				method : "GET",
				success: function(data) {
					console.log("account info", data);
				},
				error: function() {
					console.log("account info error", arguments);
				}
			}
		);
	},
	
	sendFile : function(file_name, fileEntry, blob) {	
		//start reading the file
		/*fileEntry.file(function(file) {
			var reader = new FileReader();
			reader.onloadend = function(e) {
				console.log("file loaded");
				dropbox._request("/files/dropbox/" + file_name, {
					method : "BLOB",
					subdomain : 'api-content',
					success: function(data) {
						console.log("sendBlob ", data);
					},
					error: function() {
						console.log("sendBlob error", arguments);
					}
					}, {
						file_name : file_name,
						body : this.result 
					}
				);
			};
			reader.readAsText(file);
		}, sync._fs_error_handler);*/
		
		dropbox._request("/files/dropbox/kitchen_sink", {
					method : "POST",
					type : "file",
					subdomain : 'api-content'}, 
					{
						file_name : file_name,
						body : blob,
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
			apiVersion: "0",
			sendAuth: true,
			success: $.noop,
			error: $.noop,
			type: 'none'
		}, params || {});

		if (params.sendAuth && !this._accessToken) {
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
			message.parameters.oauth_token = this._accessToken;
		}

		var oauthBits = {
			consumerSecret: this._consumerSecret
		};

		if (params.sendAuth) {
			oauthBits.tokenSecret = this._accessTokenSecret;
		}

		OAuth.setTimestampAndNonce(message);
		OAuth.SignatureMethod.sign(message, oauthBits);
		
		if(params.type == "file") {
		
			/*simple = new ChromeExOAuth(
					"",
					"",
					"",
					this._consumerKey,
					this._consumerSecret,
					"", {}
				  );	
			simple.setToken(this._accessToken);
			simple.setTokenSecret(this._accessTokenSecret);*/
			//this._uploadFile(url, data.file_name, data.body, simple);
			//$.extend(message.parameters, data);

			
			// oparam = 
			// for(var p in oparam) {
				// formdata.append(p, oparam[p]);
			// }
			
			_query_string = this._stringify(OAuth.getParameterMap(message.parameters));
			
			data.file.file(function(return_file){
				var formdata = new FormData();
				formdata.append("file", return_file);
				var req = new XMLHttpRequest();
				req.open("POST", url + '?' + _query_string);
				req.send(formdata);
			}, sync._fs_error_handler);
			
		} else {
			$.ajax({
				dataType: "json",
				method: params.method,
				url: url,
				data: OAuth.getParameterMap(message.parameters),
				success: params.success,
				error: params.error
			});
		}
	},
			
	_uploadFile : function ( url, filename, fileData, oauth_obj) {
		/*var boundaryString = "AaBbCcX30";
		var boundary = "--"+boundaryString;
		
		var postContent = "";
		params = oauth_obj.signParam(url, "POST", { });
		for(var key in params) {
			postContent += boundary+"\r\n"+
							"Content-Disposition: form-data; name=\""+ key +"\";\r\n"+
							"\r\n"+
							params[key] + "\r\n";
		}
		
		postContent += boundary+"\r\n"+
			  "Content-Disposition: form-data; name=\"file\"; filename=\""+ filename +"\"\r\n"+
			  "Content-Type: text/plain\r\n"+
			  "\r\n"+
			  "%FILECONTENT%\r\n"+
			  boundary+"--\r\n";
		
		postContent = postContent.replace("%FILECONTENT%", fileData);
		console.log( postContent );

		var req = new XMLHttpRequest();
		req.open("POST", oauth_obj.signURL(url, "POST", { }), true);
		//req.open("POST", url, true);
		//req.setRequestHeader('Authorization', oauth_obj.getAuthorizationHeader(url, "POST", {}));
		req.setRequestHeader("Content-Type", "multipart/form-data; boundary=" + boundary + ";charset=UTF-8");
		req.send(postContent);*/
		
		params = oauth_obj.signParam(url, "POST", { });
		var formdata = new FormData();
		for(var key in params) {
			formdata.append(key, params[key]);
		}
		formdata.append("file", fileData);
		var req = new XMLHttpRequest();
		req.open("POST", oauth_obj.signURL(url, "POST", { }));
		req.send(formdata);
	}
};
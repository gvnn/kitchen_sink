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
					}));
				
				console.log("open tab to:", 'https://www.dropbox.com/1' + dropbox._authorize_url + '?' + url);
				tabs.open('https://www.dropbox.com/1' + dropbox._authorize_url + '?' + url);
			},
			error: function(data) {
				console.log("account info error", data.text);
			}
		});
	},
	
	get_access_token : function(worker) {
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
				//emit status change
				worker.port.emit("set_status", 'connected');
			}
		});
	},
	
	remove_token : function(worker) {
		this.set_accessTokenSecret("access_token", "");
		this.set_accessToken("access_token_secret", "");
		console.log("disconnected");
		worker.port.emit("set_status", 'disconnected');
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
	
	upload : function() {
		var {Cc, Ci} = require("chrome");
		var historyService = Cc["@mozilla.org/browser/nav-history-service;1"].getService(Ci.nsINavHistoryService);
		var bookmarksService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
		var resultTypes = Ci.nsINavHistoryResultNode;
		//loop through bookmarks. creates a json output compatible with chrome
		_toolbarFolder = this._retrieve_tree(bookmarksService.toolbarFolder, historyService, bookmarksService, resultTypes);
		_bookmarksMenuFolder = this._retrieve_tree(bookmarksService.bookmarksMenuFolder, historyService, bookmarksService, resultTypes);
		//build the object
		var bkm = [{
		    "children": [{
		        "children": _toolbarFolder,
		        "id": "1",
		        "index": 0,
		        "parentId": "0",
		        "title": "Bookmarks bar"
		    },
		    {
		        "children": _bookmarksMenuFolder,
		        "id": "2",
		        "index": 1,
		        "parentId": "0",
		        "title": "Other bookmarks"
		    }],
		    "id": "0",
		    "title": ""
		}];
		data = JSON.stringify(bkm);
		
		//create the file
		var file = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("TmpD", Ci.nsIFile);
		file.append("bookmarks.json"); 
		file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
		var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
		foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);
		// convert to UTF-8
		var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
		converter.init(foStream, "UTF-8", 0, 0);
		converter.writeString(data);
		converter.close();
		
		dropbox.sendFile('bookmarks.json', file);
	},
	
	sendFile : function(file_name, file) {
		dropbox._request("/files/dropbox/public", {
			method : "POST",
			type : "file",
			subdomain : 'api-content'
			}, {
				file_name : file_name,
				file : file
			}
		);
	},
	
	accessToken : function() {
		return simpleStorage.settings['access_token'] == null ? "" : simpleStorage.settings['access_token'];
	},
  
	accessTokenSecret : function() {
		return simpleStorage.settings['access_token_secret'] == null ? "" : simpleStorage.settings['access_token_secret'];
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
	
	_retrieve_tree : function(folder, historyService, bookmarksService, resultTypes) {
		console.log("folder tree: " + folder);
		var _children = [];
		var options = historyService.getNewQueryOptions();
		var query = historyService.getNewQuery();
		query.setFolders([folder], 1);
		var result = historyService.executeQuery(query, options);
		var rootNode = result.root;
		rootNode.containerOpen = true;
		console.log(folder + " - found: " + rootNode.childCount);
		for (var i = 0; i < rootNode.childCount; i ++) {
			var node = rootNode.getChild(i);
			if(node) {
				var type = node.type;
				console.log(folder + " - type: " + type);
				if(type == resultTypes.RESULT_TYPE_URI) {
					// process bookmark
					_children.push({
			            "index": i,
						"title": node.title,
			            "url": node.uri,
						"id" : node.itemId
			        });
					console.log(folder + " - added: " + node.uri);
		        } else if(type == resultTypes.RESULT_TYPE_FOLDER || type == resultTypes.RESULT_TYPE_FOLDER || type == resultTypes.RESULT_TYPE_FOLDER_SHORTCUT) {
					// process folder
					_folder_childen = dropbox._retrieve_tree(node.itemId, historyService, bookmarksService, resultTypes);
					_children.push({
			            "index": i,
						"title": node.title,
						"children" : _folder_childen,
						"id" : node.itemId
			        });
					console.log(folder + " - folder: " + node.title);
		        }
			}
		}
		rootNode.containerOpen = false;
		console.log(folder + " - bookmarks: " + _children.length);
		return _children;
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
		var {Cc, Ci} = require("chrome");
		
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
		_query_string = this._stringify(this._oauth.getParameterMap(message.parameters));
		
		_rq = this._request_module({
			url: message.action,
			content: _query_string,
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
				if(params.type == "file") {
					
					var args = {"file": {"file": data.file, "filename": data.file_name}};
					var postRequest = dropbox.createPostRequest(args);
					var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
					req.onload = function(e) {
						console.log(this.response);
					}
					req.open("POST", url + '?' + _query_string);
					req.setRequestHeader("Content-Type","multipart/form-data; boundary="+postRequest.boundary);
					req.setRequestHeader("Content-Length", (postRequest.requestBody.available()));
					req.send(postRequest.requestBody);
					
				} else {
					_rq.post();
				}
				break;
		}
	},
	
	createPostRequest : function (args) {
	    /**
	   * http://www.chrisfinke.com/2010/01/30/uploading-form-data-and-files-with-javascript-mozilla/
	   * Generates a POST request body for uploading.
	   *
	   * args is an associative array of the form fields.
	   *
	   * Example:
	   * var args = { "field1": "abc", "field2" : "def", "fileField" :
	   *              { "file": theFile, "headers" : [ "X-Fake-Header: foo" ] } };
	   *
	   * theFile is an nsILocalFile; the headers param for the file field is optional.
	   *
	   * This function returns an array like this:
	   * { "requestBody" : uploadStream, "boundary" : BOUNDARY }
	   *
	   * To upload:
	   *
	   * var postRequest = createPostRequest(args);
	   * var req = new XMLHttpRequest();
	   * req.open("POST", ...);
	   * req.setRequestHeader("Content-Type","multipart/form-data; boundary="+postRequest.boundary);
	   * req.setRequestHeader("Content-Length", (postRequest.requestBody.available()));
	   * req.send(postRequest.requestBody);
	   */

	    function stringToStream(str) {
	        function encodeToUtf8(oStr) {
	            var utfStr = oStr;
	            var uConv = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
	            .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
	            uConv.charset = "UTF-8";
	            utfStr = uConv.ConvertFromUnicode(oStr);

	            return utfStr;
	        }

	        str = encodeToUtf8(str);

	        var stream = Components.classes["@mozilla.org/io/string-input-stream;1"]
	        .createInstance(Components.interfaces.nsIStringInputStream);
	        stream.setData(str, str.length);

	        return stream;
	    }

	    function fileToStream(file) {
	        var fpLocal = Components.classes['@mozilla.org/file/local;1']
	        .createInstance(Components.interfaces.nsILocalFile);
	        fpLocal.initWithFile(file);

	        var finStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
	        .createInstance(Components.interfaces.nsIFileInputStream);
	        finStream.init(fpLocal, 1, 0, false);

	        var bufStream = Components.classes["@mozilla.org/network/buffered-input-stream;1"]
	        .createInstance(Components.interfaces.nsIBufferedInputStream);
	        bufStream.init(finStream, 9000000);

	        return bufStream;
	    }

	    var mimeSvc = Components.classes["@mozilla.org/mime;1"]
	    .getService(Components.interfaces.nsIMIMEService);
	    const BOUNDARY = "---------------------------32191240128944";

	    var streams = [];

	    for (var i in args) {
	        var buffer = "--" + BOUNDARY + "\r\n";
	        buffer += "Content-Disposition: form-data; name=\"" + i + "\"";
	        streams.push(stringToStream(buffer));

	        if (typeof args[i] == "object") {
	            buffer = "; filename=\"" + args[i].filename + "\"";

	            if ("headers" in args[i]) {
	                if (args[i].headers.length > 0) {
	                    for (var q = 0; q < args[i].headers.length; q++) {
	                        buffer += "\r\n" + args[i].headers[q];
	                    }
	                }
	            }
				
				var theMimeType = "text/plain";
				try {
					theMimeType = mimeSvc.getTypeFromFile(args[i].file);
				} catch (e) {}

	            buffer += "\r\nContent-Type: " + theMimeType;
	            buffer += "\r\n\r\n";

	            streams.push(stringToStream(buffer));

	            streams.push(fileToStream(args[i].file));
	        }
	        else {
	            buffer = "\r\n\r\n";
	            buffer += args[i];
	            buffer += "\r\n";
	            streams.push(stringToStream(buffer));
	        }
	    }

	    var uploadStream = Components.classes["@mozilla.org/io/multiplex-input-stream;1"]
	    .createInstance(Components.interfaces.nsIMultiplexInputStream);

	    for (var i = 0; i < streams.length; i++) {
	        uploadStream.appendStream(streams[i]);
	    }

	    return {
	        "requestBody": uploadStream,
	        "boundary": BOUNDARY
	    };
	}
	
}

exports.dropbox = dropbox;
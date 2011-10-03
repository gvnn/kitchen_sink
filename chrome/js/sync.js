var sync = {
  
	go: function() {
		this._notification = webkitNotifications.createNotification(
			'gui/img/icon.png',
			'kitchen_sync',
			'Sync started'
		);
		this._notification.show();
		setTimeout("sync.close_notification()", 3000);
		//collecting bookmarks
		this._load_local_bookmarks();
	},
  
	close_notification : function() {
		this._notification.cancel();
	}, 
  
	_load_local_bookmarks : function() {
		chrome.bookmarks.getTree(function(results) {
			console.log("bookmarks loaded: " + results.length);
			//save bookmarks
			sync.local_bookmarks = results;
			//new filesystem obj
			window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
			window.requestFileSystem(window.TEMPORARY, 1024*1024, sync._on_init_fs, sync._fs_error_handler); // 1 MB should be enough
		});
	},
	
	_on_init_fs : function(fs) {
		console.log('Opened file system: ' + fs.name);
		filename = 'bookmarks.json';
		data = JSON.stringify(sync.local_bookmarks);
		if (!window.BlobBuilder && window.WebKitBlobBuilder) {
			window.BlobBuilder = window.WebKitBlobBuilder;
		}
		fs.root.getFile(filename, {create: true}, function(fileEntry) {		
			fileEntry.createWriter(function(fileWriter) {
			
				fileWriter.onwriteend = function(e) {
					console.log('Write completed.' + fileEntry.toURL());
					dropbox.sendFile('bookmarks.json', fileEntry, blob);					
				};
				
				fileWriter.onerror = function(e) {
					console.log('Write failed: ' + e.toString());
				};

				var builder = new BlobBuilder();
				builder.append(data);
				var blob = builder.getBlob();
				//test: send file to drop box
				fileWriter.write(blob);
				
			}, sync._fs_error_handler);
		}, sync._fs_error_handler);
	},
	
	_fs_error_handler : function(e) {
		var msg = '';
		switch (e.code) {
			case FileError.QUOTA_EXCEEDED_ERR:
				msg = 'QUOTA_EXCEEDED_ERR';
				break;
			case FileError.NOT_FOUND_ERR:
				msg = 'NOT_FOUND_ERR';
				break;
			case FileError.SECURITY_ERR:
				msg = 'SECURITY_ERR';
				break;
			case FileError.INVALID_MODIFICATION_ERR:
				msg = 'INVALID_MODIFICATION_ERR';
				break;
			case FileError.INVALID_STATE_ERR:
				msg = 'INVALID_STATE_ERR';
				break;
			default:
				msg = 'Unknown Error';
				break;
		};
		console.error('Error: ' + msg);
	}
}
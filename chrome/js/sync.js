var sync = {
  
	download : function(uid) {
		//download latest from online
		$.getJSON("http://dl.dropbox.com/u/" + uid + "/bookmarks.json", function(data) {
			//replace current bookmarks with online version
			sync.overwrite_bookmarks(data);
		});
	},
	
	upload : function() {
		chrome.bookmarks.getTree(function(results) {
			//save bookmarks
			sync.local_bookmarks = results;
			//new filesystem obj
			window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
			window.requestFileSystem(window.TEMPORARY, 1024*1024, sync._on_init_fs, sync._fs_error_handler); // 1 MB should be enough
		});
	},
	
	_add_bookmarks : function(tree, parentId) {
		for (var j=0; j < tree.children.length; j++) {
			var tree_item = tree.children[j];
			chrome.bookmarks.create({
				parentId: parentId,
				index: tree_item.index,
				title: tree_item.title,
				url: tree_item.url,
				}, function(new_node) {
					if (tree_item.children && tree_item.children.length > 0 && new_node) {
						sync._add_bookmarks(tree_item, new_node.id);
					}
				});
		}
	},
		
	overwrite_bookmarks : function(online) {
		var tree_online = online;
		//gets local tree
		chrome.bookmarks.getTree(function(tree) {
			for (var i=0; i < tree[0].children.length; i++) {
				//you can't remove a root bookmark folder, cycles on the items in root
				for (var k=0; k < tree[0].children[i].children.length; k++) {
					item_to_remove = tree[0].children[i].children[k];
					if (item_to_remove.children && item_to_remove.children.length > 0) {
						//folder
						chrome.bookmarks.removeTree(item_to_remove.id);
					} else {
						//item
						chrome.bookmarks.remove(item_to_remove.id);
					}
				};
				if (tree_online[0].children && tree_online[0].children.length > 0) {
					sync._add_bookmarks(tree_online[0].children[i], tree[0].children[i].id);
				}
			};
		});
		chrome.extension.getBackgroundPage().message('Download complete');
	},
	
	_on_init_fs : function(fs) {
		console.log('Opened file system: ' + fs.name);
		filename = 'bookmarks.json';
		data = JSON.stringify(sync.local_bookmarks);
		if (!window.BlobBuilder && window.WebKitBlobBuilder) {
			window.BlobBuilder = window.WebKitBlobBuilder;
		}
		fs.root.getFile(filename, {create: true}, function(fileEntry) {
			fileEntry.remove(function() {
				console.log('File removed.');
				
				fs.root.getFile(filename, {create: true}, function(fileEntry) {		
					fileEntry.createWriter(function(fileWriter) {

						fileWriter.onwriteend = function(e) {
							console.log('Write completed.' + fileEntry.toURL());
							dropbox.sendFile('bookmarks.json', fileEntry);					
						};

						fileWriter.onerror = function(e) {
							console.log('Write failed: ' + e.toString());
						};

						var bb = new BlobBuilder();
						bb.append(data);
						fileWriter.write(bb.getBlob('text/plain'));

					}, sync._fs_error_handler);
				}, sync._fs_error_handler);
				
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
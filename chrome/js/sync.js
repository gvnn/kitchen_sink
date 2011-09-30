var sync = {

  setup: function(dropbox_obj) {
	this._dropbox = dropbox_obj;
  },
  
  go: function() {
	this._notification = webkitNotifications.createNotification(
		'gui/img/icon.png',
		'kitchen_sync',
		'Sync started'
	);
	this._notification.show();
	setTimeout("sync.close_notification()", 3000);
  },
  
  close_notification : function() {
	this._notification.cancel();
  }

}
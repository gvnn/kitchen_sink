$(document).ready(function(){
	$("#btn_get_token").click(function() {
		if($("#app_key").val() != '' & $("#app_secret").val() != '') {
			self.port.emit('save_settings', {
				'app_key' : $("#app_key").val(),
				'app_secret' : $("#app_secret").val()
			});
			$("#btn_get_access").show();
			self.port.emit('get_token');
		}
	});
	
	$("#btn_get_access").click(function() {
		self.port.emit('get_access_token');
	});
	
	$("#lnk_remove_connection").click(function() {
		self.port.emit('remove_token');
	});
	
	$("#lnk_download").click(function() {
		self.port.emit('download_bookmarks');
	});
	
	$("#lnk_upload").click(function() {
		self.port.emit('upload_bookmarks');
	});
	
});

//get current settings
self.port.emit('get_settings');
self.port.on('set_settings', function onMessage(settings) {
	$("#app_key").val(settings.app_key);
	$("#app_secret").val(settings.app_secret);
});

self.port.on('set_status', function onMessage(status) {
	switch(status) {
		case "connected":
			$("#connected_form").show();
			$("#connection_form").hide();
			$("#password").val("");
			break;
		case "disconnected":
			$("#connected_form").hide();
			$("#connection_form").show();
			break;
	}
});
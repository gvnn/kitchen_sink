self.port.on("switch_form", function(status) {
	swich_status(status);
});

var swich_status = function(status) {
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
}

var get_token = function() {
	var app_key = $("#app_key").val(),
		app_secret = $("#app_secret").val();
	//saving settings
	self.port.emit('save_key_secret', { 'key' : app_key, 'secret' : app_secret });
}

var remove_connection = function() {
	self.port.emit('delete_key_secret');
}

var download_bookmarks = function() {
	
}

var upload_bookmarks = function() {
	
}

$(document).ready(function() {
	self.port.emit('check_status');
	$("#btn_get_token").click(get_token);
	$("#btn_remove_connection").click(remove_connection);
	$("#btn_download").click(download_bookmarks);
	$("#btn_upload").click(upload_bookmarks);
});
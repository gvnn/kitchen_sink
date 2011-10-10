$(document).ready(function(){
	$("#options_link").click(function(){
		self.port.emit('options_click');
	});
	
	$("#upload_link").click(function(){
		self.port.emit('upload_click');
	});
	
	$("#download_link").click(function(){
		self.port.emit('download_click');
	});
});
const widgets = require("widget");
const data = require("self").data;
const simpleStorage = require("simple-storage").storage;
const tabs = require("tabs");

var menuPanel = require("panel").Panel({
	width: 220,
	height: 110,
	contentURL: data.url("menu.html"),
	contentScriptFile: [data.url("js/jquery-1.6.4.min.js"), data.url("menu.js")]
});

var optionPanel = require("panel").Panel({
	width: 900,
	height: 400,
	contentURL: data.url("options.html"),
	contentScriptFile: [data.url("js/jquery-1.6.4.min.js"), data.url("options.js")]
});

menuPanel.port.on("options_click", function() {
	open_options();
});

menuPanel.port.on("upload_click", function() {
	if(simpleStorage.app_key && simpleStorage.app_secret) {
		//start upload
	} else {
		//settings required
		open_options();
	}
});

menuPanel.port.on("download_click", function() {
	if(simpleStorage.app_key && simpleStorage.app_secret) {
		//start download
	} else {
		//settings required
		open_options();
	}
});

optionPanel.port.on("save_key_secret", function(config) {
	simpleStorage.app_key = config['key'];
	simpleStorage.app_secret = config['secret'];
	optionPanel.port.emit('switch_form', 'connected');
});

optionPanel.port.on("delete_key_secret", function(config) {
	simpleStorage.app_key = null;
	simpleStorage.app_secret = null;
	optionPanel.port.emit('switch_form', 'disconnected');
});

optionPanel.port.on("check_status", function() {
	//check if app_key & app_secret are present
	optionPanel.port.emit('switch_form', (simpleStorage.app_key && simpleStorage.app_secret) ? 'connected' : 'disconnected');
});

//opens the options page
var open_options = function() {
	optionPanel.show();
}

var widget = widgets.Widget({
	id: "options-link",
	label: "kitchen_sink",
	panel: menuPanel,
	contentURL: data.url("gui/img/icon.png")
});
const widgets = require("widget");
const data = require("self").data;
const simpleStorage = require("simple-storage").storage;
const tabs = require("tabs");

var optionsPanel = require("panel").Panel({
	width: 220,
	height: 110,
	contentURL: data.url("menu.html"),
	contentScriptFile: [data.url("js/jquery-1.6.4.min.js"), data.url("menu.js")]
});

optionsPanel.port.on("options_click", function() {
	open_options();
});

optionsPanel.port.on("upload_click", function() {
	if(simpleStorage.app_key && simpleStorage.app_secret) {
		//start upload
	} else {
		//settings required
		open_options();
	}
});

optionsPanel.port.on("download_click", function() {
	if(simpleStorage.app_key && simpleStorage.app_secret) {
		//start download
	} else {
		//settings required
		open_options();
	}
});

//opens the options page
var open_options = function() {
	tabs.open({
		url: data.url("options.html"),
		onReady: function onReady(tab) {
			tab.attach({
				contentScriptFile: [data.url("js/jquery-1.6.4.min.js"), data.url("options.js")]
			});
		}
	});
}

var widget = widgets.Widget({
	id: "options-link",
	label: "kitchen_sink",
	panel: optionsPanel,
	contentURL: data.url("gui/img/icon.png")
});
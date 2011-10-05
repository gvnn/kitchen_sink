var settings = {

	set_value : function (key, value) {
		var config = {};
		if (localStorage.config)
			config = JSON.parse(localStorage.config);
		
		config[key] = value;
		localStorage.config = JSON.stringify(config);   
	},
	
	get_value : function (key, default_value) {
    
		if (!localStorage.config)
			return default_value;
		
		var config = JSON.parse(localStorage.config);
		if (config[key] == undefined)
			return default_value;
		
		return config[key];
	}
	
};
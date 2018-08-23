'use strict';

let options = require('minimist')(process.argv.slice(2), {  
	default: {
		model: "@/model/javascript/model.json",
		templates: "@/model/javascript/templates",
		theme: "default",
		templateFunctions: "@/template-functions/**/*.js"
	}
});

console.log(options);

if (!options.src) {
	console.error("Missing src option");
	process.exit(1);
}

if (!options.dest) {
	console.error("Missing dest option");
	process.exit(1);
}

const model = require('./lib/model.js');
const templates = require("./lib/templates.js");

var onerror = function(e) {
	console.error(e);
	process.exit(1);
};

model.loadDefinition(options.model);
model.loadContent(options.src)
.then(function(content) {
	// TODO
	console.log(require('util').inspect(content, false, null));
	
	templates.loadFunctions(options.templateFunctions);
	templates.generate(content, options.templates, options.theme, options.dest)
	.then(function() {
		console.log("Done.");
	}, onerror);
}, onerror);

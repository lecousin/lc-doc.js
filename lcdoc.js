'use strict';

let options = require('minimist')(process.argv.slice(2), {  
	default: {
		model: "@/model/javascript/model.json",
		templates: "@/model/javascript/templates",
		theme: "default",
		templateFunctions: "@/template-functions/**/*.js",
		external: "@/model/javascript/external/mdn.json"
	}
});

console.log(options);

var onerror = function(e) {
	console.error(e);
	process.exit(1);
};

if (!options.dest) {
	console.error("Missing dest option");
	process.exit(1);
}

if (!options.src) {
	console.error("Missing src option");
	process.exit(1);
}

const model = require('./lib/model.js');
const templates = require("./lib/templates.js");

var generateDoc = function(src) {
	model.loadDefinition(options.model);
	model.loadExternals(options.external);
	model.loadContent(src)
	.then(function(content) {
		//console.log(require('util').inspect(content, false, null));
		
		templates.loadFunctions(options.templateFunctions);
		templates.generate(model, options.templates, options.theme, options.dest)
		.then(function() {
			console.log("Done.");
		}, onerror);
	}, onerror);
};

var generateModel = function(src, generator) {
	require("./lib/generator.js").generate(src, generator)
	.then(function(generatedPath) {
		generateDoc(generatedPath + "/*.xml");
	}, onerror);
};

if (options.generator) {
	generateModel(options.src, options.generator);
} else {
	generateDoc(options.src);
}

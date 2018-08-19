lcdoc = {
		
	templateBaseUrl: "",
	namespaceTemplate: "template-namespace.html",
	classTemplate: "template-class.html",
	methodTemplate: "template-method.html",
		
	open: function(url, callback) {
		lcdoc._get(url + 'files.txt', function(s) {
			if (!s) return;
			var lines = s.split("\n");
			var count = 0;
			for (var i = 0; i < lines.length; ++i) {
				var line = lines[i].trim();
				if (line.length == 0) continue;
				count++;
				var u = url + line;
				lcdoc._get(url + line, function(content) {
					if (content)
						lcdoc._parseDocFile(content, u);
					if (--count == 0)
						callback();
				});
			}
		});
	},
	
	_get: function(url, callback) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", url, true);
		xhr.onreadystatechange = function() {
			if (this.readyState != 4)
				return;
			if (this.status != 200) {
				lcdoc._error("Unable to load resource: " + url);
				callback(null);
				return;
			}
			callback(xhr.responseText);
		};
		xhr.send();
	},
	
	_error: function(error) {
		// TODO show errors
		console.error(error);
	},
	
	_model: {
		children: []
	},
	_modelElements: [],
	
	_addModelElement: function(e) {
		e.id = lcdoc._modelElements.length;
		lcdoc._modelElements.push(e);
	},
	
	showById: function(id) {
		var model = lcdoc._modelElements[id];
		lcdoc.produceContent(model);
	},
	
	_comparator: function(e1, e2) {
		return e1.name.localeCompare(e2.name);
	},
	_sort: function(model) {
		if (model.children) model.children.sort(lcdoc._comparator);
		if (model.methods) model.methods.sort(lcdoc._comparator);
	},
	
	_parseDocFile: function(content, url) {
		var xml = new DOMParser().parseFromString(content, "application/xml").documentElement;
		lcdoc._parse(xml, lcdoc._model, url);
		lcdoc._sort(lcdoc._model);
	},
	
	_parse: function(element, model, url) {
		for (var i = 0; i < element.childNodes.length; ++i) {
			var node = element.childNodes[i];
			if (node.nodeType == 1) {
				var name = node.nodeName.toLowerCase();
				if (name == "namespace") {
					lcdoc._parseNamespace(node, model, url);
				} else if (name == "class") {
					lcdoc._parseClass(node, model, url);
				} else if (name == "description") {
					model.description = node.innerHTML;
				} else if (name == "method") {
					lcdoc._parseMethod(node, model, url);
				} else
					lcdoc._error("Unknown element " + name + " in " + url);
			}
		}
	},
	
	_parseNamespace: function(element, model, url) {
		var ns = {
			type: "namespace",
			name: element.getAttribute("name"),
			children: []
		};
		model.children.push(ns);
		lcdoc._addModelElement(ns);
		lcdoc._parse(element, ns, url);
	},

	_parseClass: function(element, model, url) {
		var c = {
			type: "class",
			name: element.getAttribute("name"),
			children: []
		};
		model.children.push(c);
		lcdoc._addModelElement(c);
		lcdoc._parse(element, c, url);
	},
	
	_parseMethod: function(element, model, url) {
		var m = {
			type: "method",
			name: element.getAttribute("name"),
			isStatic: model.type == "namespace" || element.hasAttribute("static"),
			parameters: [],
			returns: undefined
		};
		if(!model.methods) model.methods = [];
		model.methods.push(m);
		lcdoc._addModelElement(m);
		for (var i = 0; i < element.childNodes.length; ++i) {
			var node = element.childNodes[i];
			if (node.nodeType == 1) {
				var name = node.nodeName.toLowerCase();
				if (name == "description") {
					m.description = node.innerHTML;
				} else if (name == "param" || name == "parameter") {
					m.parameters.push({
						type: node.getAttribute("type"),
						name: node.getAttribute("name"),
						description: node.innerHTML
					});
				} else if (name == "return") {
					m.returns = {
						type: node.getAttribute("type"),
						description: node.innerHTML
					};
				} else
					lcdoc._error("Unknown element " + name + " for a mathod in " + url);
			}
		}
	},
	
	_contentContainer: null,
	generate: function(container) {
		container.className = container.className + " lc-doc";
		container.innerHTML = "";
		var tree = document.createElement("DIV");
		tree.className = "lc-doc-tree";
		container.appendChild(tree);
		var content = document.createElement("DIV");
		content.className = "lc-doc-content";
		container.appendChild(content);
		lcdoc._contentContainer = content;
		lcdoc._generateChildren(tree, lcdoc._model);
	},
	
	_generateChildren: function(tree, model) {
		for (var i = 0; i < model.children.length; ++i) {
			var child = model.children[i];
			if (child.type == "namespace") {
				var node = lcdoc._createTreeNode(tree, child, true);
				lcdoc._generateChildren(node, child);
				if (child.methods)
					lcdoc._generateMethods(node, child);
			} else if (child.type == "class") {
				var node = lcdoc._createTreeNode(tree, child, true);
				lcdoc._generateChildren(node, child);
				if (child.methods)
					lcdoc._generateMethods(node, child);
			} else
				lcdoc._error("Unexpected model element type: " + child.type);
		}
	},
	
	_generateMethods: function(tree, model) {
		for (var i = 0; i < model.methods.length; ++i) {
			var m = model.methods[i];
			var node = lcdoc._createTreeNode(tree, m, false);
		}
	},
	
	_createTreeNode: function(tree, model, hasContent) {
		var node = document.createElement("DIV");
		node.className = "lc-doc-tree-node lc-doc-" + model.type;
		if (model.isStatic)
			node.className += " lc-doc-static";
		tree.appendChild(node);
		
		var icon = document.createElement("DIV");
		icon.className = "lc-doc-tree-node-icon";
		node.appendChild(icon);
		
		var link = document.createElement("A");
		link.href = "#";
		link.appendChild(document.createTextNode(model.name));
		link.onclick = function() {
			lcdoc.produceContent(model);
			return false;
		};
		node.appendChild(link);

		if (hasContent) {
			var content = document.createElement("DIV");
			content.className = "lc-doc-tree-node-content lc-doc-tree-node-content-expanded";
			tree.appendChild(content);
			var button = document.createElement("DIV");
			button.className = "lc-doc-tree-node-expand-button lc-doc-tree-node-expanded";
			button.onclick = function() {
				if (content.className.indexOf("expanded") > 0) {
					content.className = content.className.replace("expanded", "collapsed");
					button.className = button.className.replace("expanded", "collapsed");
				} else {
					content.className = content.className.replace("collapsed", "expanded");
					button.className = button.className.replace("collapsed", "expanded");
				}
			};
			node.insertBefore(button, icon);
			return content;
		} else
			return node;
	},
	
	_templates: [],
	produceContent: function(model) {
		lcdoc._contentContainer.innerHTML = "Loading...";
		for (var i = 0; i < lcdoc._templates.length; ++i) {
			if (lcdoc._templates[i].name == model.type) {
				lcdoc._executeTemplate(model, lcdoc._templates[i].content);
				return;
			}
		}
		var templateUrl = lcdoc.templateBaseUrl + lcdoc[model.type + "Template"];
		lcdoc._get(templateUrl, function(template) {
			lcdoc._templates.push({ name: model.type, content: template});
			lcdoc._executeTemplate(model, template);
		});
	},
	
	_executeTemplate: function(model, template) {
		template = template
			.replace(/&gt;/g, ">")
			.replace(/&lt;/g, "<")
			.replace(/&amp;/g, "&")
			;
		lcdoc._contentContainer.innerHTML = lcdoc._parseTemplate(model, template, undefined).result;
	},
	
	_parseTemplate: function(model, template, expectedEnd, ignoreErrors) {
		var pos = 0;
		var diff = 0;
		while (pos < template.length) {
			var i = template.indexOf("{{", pos);
			if (i < 0) break;
			var j = template.indexOf("}}", i + 2);
			if (j < 0) break;
			var content = template.substring(i + 2, j);
			if (content == "end" + expectedEnd) {
				return { result: template.substring(0, i), pos: j + 2 - diff };
			}
			if (content.startsWith("if ")) {
				var condition = content.substring(3).trim();
				var conditionTrue = lcdoc._evaluate(condition, model, ignoreErrors);
				var inside = lcdoc._parseTemplate(model, template.substring(j + 2), "if", !conditionTrue);
				if (conditionTrue) {
					var resolved = inside.result;
					if (!resolved) resolved = "";
					template = template.substring(0, i) + resolved + template.substring(j + 2 + inside.pos);
					pos = i + ("" + resolved).length;
					diff += ("" + resolved).length - (j + 2 + inside.pos - i);
				} else {
					template = template.substring(0, i) + template.substring(j + 2 + inside.pos);
					diff -= j + 2 + inside.pos - i;
				}
			} else if (content.startsWith("foreach ")) {
				content = content.substring(8).trim();
				var sep = content.indexOf(' ');
				if (sep < 0) {
					pos = j + 2;
					continue;
				}
				var array = lcdoc._evaluate(content.substring(0, sep), model, ignoreErrors);
				var loopVariable = content.substring(sep + 1).trim();
				var newModel = {};
				for (var name in model) newModel[name] = model[name];
				var resolved = "";
				var afterPos = 0;
				if (array && !ignoreErrors) {
					for (var index = 0; index < array.length; ++index) {
						newModel[loopVariable] = array[index];
						newModel[loopVariable + "Index"] = index;
						var inside = lcdoc._parseTemplate(newModel, template.substring(j + 2), "foreach", false);
						resolved += inside.result;
						afterPos = inside.pos;
					}
				} else {
					var inside = lcdoc._parseTemplate(model, template.substring(j + 2), "foreach", true);
					afterPos = inside.pos;
				}
				template = template.substring(0, i) + resolved + template.substring(j + 2 + afterPos);
				pos = i + ("" + resolved).length;
				diff += ("" + resolved).length - (j + 2 + afterPos - i);
			} else if (content.startsWith("filter ")) {
				content = content.substring(7).trim();
				var sep = content.indexOf(' ');
				if (sep < 0) {
					pos = j + 2;
					continue;
				}
				var sourceArray = lcdoc._evaluate(content.substring(0, sep), model, ignoreErrors);
				content = content.substring(sep + 1).trim();
				sep = content.indexOf(' ');
				if (sep < 0) {
					pos = j + 2;
					continue;
				}
				var loopVariable = content.substring(0, sep);
				content = content.substring(sep + 1).trim();
				sep = content.indexOf(' ');
				if (sep < 0) {
					pos = j + 2;
					continue;
				}
				var targetArrayName = content.substring(0, sep);
				var targetArray = [];
				if (sourceArray)
					for (var index = 0; index < sourceArray.length; ++index) {
						var newModel = {};
						for (var name in model) newModel[name] = model[name];
						newModel[loopVariable] = sourceArray[index];
						newModel[loopVariable + "Index"] = index;
						var condition = lcdoc._evaluate(content.substring(sep + 1), newModel, ignoreErrors);
						if (condition)
							targetArray.push(sourceArray[index]);
					}
				var newModel = {};
				for (var name in model) newModel[name] = model[name];
				newModel[targetArrayName] = targetArray;
				model = newModel;
				template = template.substring(0, i) + template.substring(j + 2);
				pos = i;
				diff -= j + 2 - i;
			} else {
				var resolved = lcdoc._evaluate(content, model, ignoreErrors);
				if (!resolved) resolved = "";
				template = template.substring(0, i) + resolved + template.substring(j + 2);
				pos = i + ("" + resolved).length;
				diff += ("" + resolved).length - (j + 2 - i);
			}
		}
		return { result: template, pos: pos - diff };
	},
	
	_evaluate: function(expr, model, ignoreErrors) {
		var code = "(function(";
		var first = true;
		for (var name in model) {
			if (first) first = false; else code += ",";
			code += name;
		}
		code += "){return (" + expr + ");})(";
		first = true;
		for (var name in model) {
			if (first) first = false; else code += ",";
			code += "model." + name;
		}
		code += ")";
		try {
			return new Function("model", "return (" + code + ")")(model);
		} catch (error) {
			if (!ignoreErrors)
				console.error(error + " in " + code);
			return "";
		}
	}
	
};

// polyfill
if (!String.prototype.startsWith) {
	String.prototype.startsWith = function(search, pos) {
		return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
	};
}

const fs = require("fs");
const acorn = require("acorn");

var getNodeFullName = function(node) {
	if (node.type == "MemberExpression")
		return getNodeFullName(node.object) + '.' + getNodeFullName(node.property);
	if (node.type == "Identifier")
		return node.name;
	return "?" + node.type + "?";
};

var parseComment = function(comment) {
	var lines = comment.split(/\n/g);
	var res = {
		text: "",
		tags: []
	};
	var tag = res;
	for (var i = 0; i < lines.length; ++i) {
		var line = lines[i].trim();
		if (line.startsWith("*")) line = line.substring(1).trim();
		if (line.startsWith("@")) {
			var j = line.indexOf(' ');
			if (j < 0) j = line.length;
			tag = {
				name: line.substring(1, j),
				text: line.substring(j).trim()
			};
			res.tags.push(tag);
			continue;
		}
		if (tag.text.length > 0) tag.text += " ";
		tag.text += line;
	}
	return res;
};

var getTags = function(comment, tagName) {
	var tags = [];
	for (var i = 0; i < comment.tags.length; ++i)
		if (comment.tags[i].name == tagName)
			tags.push(comment.tags[i].text);
	return tags;
};

var getTag = function(comment, tagName) {
	var tags = getTags(comment, tagName);
	if (tags.length > 0)
		return tags[0];
	return null;
};

var getChildNode = function(parent, childName) {
	for (var i = 0; i < parent.children.length; ++i)
		if (parent.children[i].name == childName)
			return parent.children[i];
	return null;
};

var createNode = function(root, name) {
	var names = name.split(".");
	var parent = root;
	for (var i = 0; i < names.length; ++i) {
		var child = getChildNode(parent, names[i]);
		if (!child) {
			child = {
				type: "namespace",
				name: names[i],
				children: []
			};
			parent.children.push(child);
		}
		parent = child;
	}
	return parent;
};

var createNamespace = function(root, text) {
	var i = text.indexOf(' ');
	var name, description;
	if (i < 0) {
		name = text.trim();
		description = "";
	} else {
		name = text.substring(0, i).trim();
		description = text.substring(i + 1).trim();
	}
	var node = createNode(root, name);
	node.type = "namespace";
	node.children = [{
		type: "description",
		content: description
	}];
	return node;
};

var createClass = function(root, text, c) {
	var i = text.indexOf(' ');
	var name, description;
	if (i < 0) {
		name = text.trim();
		description = "";
	} else {
		name = text.substring(0, i).trim();
		description = text.substring(i + 1).trim();
	}
	var node = createNode(root, name);
	node.type = "class";
	node.children = [{
		type: "description",
		content: description
	}];
	var ext = getTag(c, "extends");
	if (ext) {
		ext = ext.split(/[, ]/g);
		for (var i = 0; i < ext.length; ++i) {
			var superclass = ext[i].trim();
			if (superclass.length == 0) continue;
			node.children.push({ type: "extends", attributes: { "superclass": superclass } });
		}
	}
	return node;
};

var processParamTags = function(c, m) {
	var params = getTags(c, "param");
	for (var i = 0; i < params.length; ++i) {
		var param = params[i];
		var j = param.indexOf(' ');
		if (j < 0) {
			console.warn("Invalid @param on method " + m.name + ": " + params[i]);
			continue;
		}
		var pname = param.substring(0, j).trim();
		param = param.substring(j + 1).trim();
		var ptype, pdescr;
		j = param.indexOf(' ');
		if (j < 0) {
			ptype = param;
		} else {
			ptype = param.substring(0, j).trim();
			pdescr = param.substring(j + 1).trim();
		}
		var p = {
			type: 'parameter',
			attributes: {
				name: pname,
				type: ptype
			}
		};
		if (pdescr)
			p.content = pdescr;
		m.children.push(p);
	}
	// TODO warning if missing param or unknown param
};

var processConstructorComment = function(c, ctor, ctorTag, node) {
	if (ctorTag.length > 0)
		ctor.children.push({
			type: "description",
			content: ctorTag
		});
	processParamTags(c, ctor);
};

var processMethodComment = function(c, m, node) {
	// description
	var descr = c.text.trim();
	if (descr.length > 0)
		m.children.push({ type: 'description', content: descr });
	// parameters
	processParamTags(c, m);
	// returns
	var r = getTag(c, "returns");
	if (r) {
		var j = r.indexOf(' ');
		var rtype, rdescr;
		if (j < 0) {
			rtype = param;
		} else {
			rtype = r.substring(0, j).trim();
			rdescr = r.substring(j + 1).trim();
		}
		var ret = {
			type: "return",
			attributes: {
				type: rtype
			}
		};
		if (rdescr) ret.content = rdescr;
		m.children.push(ret);
	}
	// throws
	var t = getTag(c, "throws");
	if (t) {
		m.children.push({
			type: "throw",
			content: t
		});
	}
}

var processPropertyComment = function(c, name, node) {
	var p = {
		type: 'property',
		name: name,
		children: []
	};
	var i = c.text.indexOf(' ');
	if (i < 0) throw "Invalid property comment <type> <description>: " + c.text;
	p.attributes = { type: c.text.substring(0, i).trim() };
	p.children.push({ type: "description", content: c.text.substring(i + 1).trim() });
	return p;
};

var processComment = function(comment, node, root, context) {
	//console.log("Comment: " + comment.text);
	var c = parseComment(comment.text);
	//console.log("Parsed: " + require('util').inspect(c, { depth: 2 } ));
	var t = getTag(c, "namespace");
	if (t !== null)
		return createNamespace(root, t);
	t = getTag(c, "class");
	if (t !== null)
		return createClass(root, t, c);
	t = getTag(c, "constructor");
	if (t !== null) {
		if (!context || context.type != 'class') throw "Constructor declared outside a class context";
		var ctor = {
			type: 'constructor',
			children: []
		};
		context.children.push(ctor);
		processConstructorComment(c, ctor, t, node);
		return context;
	}

	if (node) {
		if (context) {
			if (context.type == 'class' || context.type == 'namespace') {
				if (node.type == 'Property') {
					var name = node.key.name;
					if (name.startsWith("_")) return context; // private
					if (node.value.type == "FunctionExpression") {
						// method
						var m = {
							type: 'method',
							name: name,
							children: []
						};
						context.children.push(m);
						processMethodComment(c, m, node);
						return context;
					} else {
						// property
						context.children.push(processPropertyComment(c, name, node));
						return context;
					}
				}
			}
		}
		if (node.type == "ExpressionStatement" &&
			node.expression.type == "AssignmentExpression") {
			var left = node.expression.left;
			var right = node.expression.right;
			var fullpath = getNodeFullName(left);
			if (right.type == "FunctionExpression") {
				// method
				var m = createNode(root, fullpath);
				m.type = "method";
				m.attributes = {
					isStatic: true
				};
				m.children = [];
				processMethodComment(c, m, node);
				return null;
			} else {
				// property
				// TODO
				return null;
			}
		}
	}
	console.warn("Unable to determine what is this comment: " + comment.text);
	console.warn("Associated code: " + require('util').inspect(node, { depth: 3 } ));
	return context;
};

var visitAst = function(node, comments, root, context) {
	if (!node) return;
	if (comments.length == 0) return; // no more comment
	if (node.end < comments[0].pos) return; // before next comment
	if (node.start <= comments[0].pos && node.end >= comments[0].pos) {
		// next comment is inside
		for (var name in node) {
			if (node[name] === null) continue;
			var children;
			if (Array.isArray(node[name]))
				children = node[name];
			else
				children = [node[name]];
			for (var i = 0; i < children.length; ++i) {
				if (typeof children[i]["start"] != 'number') continue;
				visitAst(children[i], comments, root, context);
			}
		}
		return;
	}
	// process orphan comments
	while (comments.length > 1 && node.start > comments[1].pos) {
		processComment(comments[0], null, root, context);
		comments.splice(0, 1);
	}
	if (node.start > comments[0].pos) {
		// next comment is for this node
		var ctx = processComment(comments[0], node, root, context);
		comments.splice(0, 1);
		for (var name in node) {
			if (node[name] === null) continue;
			var children;
			if (Array.isArray(node[name]))
				children = node[name];
			else
				children = [node[name]];
			for (var i = 0; i < children.length; ++i) {
				if (typeof children[i]["start"] != 'number') continue;
				visitAst(children[i], comments, root, ctx);
			}
		}
	}
};

// --- XML Generation ---

var indent = function(size) {
	var s = "";
	for (var i = 0; i < size; ++i)
		s += "\t";
	return s;
};

var encodeXML = function(s) {
	return s; // TODO
};

var generateXMLChildren = function(node, indentSize) {
	if (!node.children) return "";
	var xml = "";
	for (var i = 0; i < node.children.length; ++i) {
		var child = node.children[i];
		xml += indent(indentSize);
		xml += "<" + child.type;
		if (child.name) xml += " name=\"" + child.name + "\"";
		if (child.attributes)
			for (var name in child.attributes)
				xml += " " + name + "=\"" + encodeXML(child.attributes[name]) + "\"";
		if (child.content)
			xml += ">" + child.content + "</" + child.type + ">";
		else if (child.children && child.children.length > 0) {
			xml += ">\n";
			xml += generateXMLChildren(child, indentSize + 1);
			xml += indent(indentSize) + "</" + child.type + ">";
		} else
			xml += "/>";
		xml += "\n";
	}
	return xml;
};

var generateXML = function(root) {
	var xml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
	xml += "<doc>\n";
	xml += generateXMLChildren(root, 1);
	xml += "</doc>\n";
	return xml;
};

module.exports = {
	
	generate: function(srcFile, dstFile) {
		return new Promise(function(success, error) {
			console.log("Generating from " + srcFile);
			fs.readFile(srcFile, function(err, content) {
				new Promise(function(success, error) {
					var comments = [];
					
					var ast = acorn.parse(content, {
						onComment: function(block, text, start, end) {
							if (!block) return;
							if (text.startsWith("*")) comments.push({ text: text, pos: start });
						}
					});
					
					var root = {
						type: 'root',
						children: []
					};
					
					visitAst(ast, comments, root, null);
					
					var context = null;
					
					for (var i = 0; i < comments.length; ++i) {
						context = processComment(comments[i], ast, root, context);
					}
					
					var xml = generateXML(root);
					//console.log(xml);
					
					//console.log(require('util').inspect(comments, false, null));
					//console.log(require('util').inspect(root, false, null));
					//console.log(require('util').inspect(ast, false, null));
					
					fs.writeFile(dstFile, xml, function(err) {
						if (err) error(err);
						else {
							console.log("File generated: " + dstFile);
							success();
						}
					});
				}).then(success, error);
			});
		});
	}
		
};
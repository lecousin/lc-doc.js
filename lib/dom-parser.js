const xmlStream = require("node-xml-stream-parser");

function DOMDocument() {
	
};

function DOMNode() {
}
DOMNode.prototype = {
};
DOMNode.prototype.constructor = DOMNode;

function DOMElement(name, attrs) {
	this.nodeName = name;
	this.nodeType = 1;
	this.attributes = attrs;
	this.childNodes = [];
};
DOMElement.prototype = new DOMNode();
DOMElement.prototype.constructor = DOMElement;
DOMElement.prototype.getTextContent = function() {
	var text = "";
	for (var i = 0; i < this.childNodes.length; ++i) {
		var child = this.childNodes[i];
		if (child.nodeType == 3)
			text += child.nodeValue;
		else if (child.nodeType == 1)
			text += child.getTextContent();
	}
	return text;
};
DOMElement.prototype.getInnerXML = function() {
	var xml = "";
	for (var i = 0; i < this.childNodes.length; ++i) {
		var child = this.childNodes[i];
		xml += child.toString();
	}
	return xml;
};
DOMElement.prototype.toString = function() {
	var xml = "<" + this.nodeName;
	for (var name in this.attributes) {
		xml += " " + name + "=\"" + this.attributes[name] + "\""; // TODO escape
	}
	xml += ">" + this.getInnerXML() + "</" + this.nodeName + ">";
};

function DOMText(text) {
	this.nodeValue = text;
	this.nodeName = "#text";
	this.nodeType = 3;
}
DOMText.prototype = new DOMNode();
DOMText.prototype.constructor = DOMText;
DOMText.prototype.toString = function() {
	return this.nodeValue;
};


module.exports = {
	
	parse: function(xml) {
		return new Promise(function(success, error) {
			var parser = new xmlStream();
			var dom = new DOMDocument();
			var elements = [];
			
			parser.on('opentag', (name, attrs) => {
				var e = new DOMElement(name, attrs);
				if (elements.length == 0)
					dom.documentElement = e;
				else
					elements[elements.length - 1].childNodes.push(e);
				elements.push(e);
			});
			parser.on('closetag', name => {
				if (elements.length == 0)
					throw "Unexpected closing tag " + name;
				if (elements[elements.length - 1].nodeName != name)
					throw "Unexpected closing tag " + name;
				elements.splice(elements.length - 1, 1);
			});
			parser.on('text', text => {
				if (elements.length > 0)
					elements[elements.length - 1].childNodes.push(new DOMText(text));
			});
			parser.on('cdata', cdata => {
			    // cdata = 'data'
			});
			parser.on('instruction', (name, attrs) => {
			    // name = 'xml'
			    // attrs = { version: '1.0' }
			});
			parser.on('error', err => {
			    // Handle a parsing error
				error(err);
			});
			parser.on('finish', () => {
			    // Stream is completed
				success(dom);
			});
			parser.write(xml);
			parser.end();
		});
	}
		
};
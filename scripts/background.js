(function(w,d){
chrome.extension.onRequest.addListener(function(req,sender,sendResponse){
	var	keys=req.keys,rsp={};
	for (var ci=0,len=keys.length; ci<len; ci++) {
		var	key=keys[ci];
		rsp[key]=localStorage[key];
	}
	sendResponse(rsp);
});

chrome.extension.onConnect.addListener(function(port){
	if (port.name=='open_in_tab') {
		port.onMessage.addListener(function(message,con){
			chrome.tabs.create({"url":message.url, "selected":(message.selected)?true:false});
		});
	}
});
})(window,document);

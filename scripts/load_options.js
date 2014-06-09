(function(w,d){
if (!w.location.href.match(/^https?:\/\/twitter\.com/)) return;

w.twDisplayVicinity_Chrome = true;

var	keys=[
	'USE_SEARCH_TL_BY_DEFAULT'
,	'FLG_TWITSPRITZ'
,	'HOUR_AFTER'
,	'LINK_TEXT'
,	'ACT_LINK_TEXT'
,	'TS_LINK_TEXT'
];

var	escape_html = function(html){
	var container = d.createElement('div');
	container.appendChild(d.createTextNode(html));
	return container.innerHTML;
};	//	end of escape_html()

var	get_bool = function(val){
	if (val === '0' || val === 0 || val === false || val === 'false') return false;
	if (val === '1' || val === 1 || val === true || val === 'true') return true;
	return null;
};	//	end of get_bool()

chrome.extension.sendRequest({keys:keys}, function(rsp){
	w.twDisplayVicinity_Options={
		USE_SEARCH_TL_BY_DEFAULT : (rsp.USE_SEARCH_TL_BY_DEFAULT === undefined) ? null : get_bool(rsp.USE_SEARCH_TL_BY_DEFAULT)
	,	FLG_TWITSPRITZ : (rsp.FLG_TWITSPRITZ === undefined) ? null : get_bool(rsp.FLG_TWITSPRITZ)
	,	HOUR_AFTER : isNaN(rsp.HOUR_AFTER) ? null : parseInt(rsp.HOUR_AFTER)
	,	LINK_TEXT : (rsp.LINK_TEXT === undefined) ? null : escape_html(rsp.LINK_TEXT)
	,	ACT_LINK_TEXT : (rsp.ACT_LINK_TEXT === undefined) ? null : escape_html(rsp.ACT_LINK_TEXT)
	,	TS_LINK_TEXT : (rsp.TS_LINK_TEXT === undefined) ? null : escape_html(rsp.TS_LINK_TEXT)
	};
	console.log(JSON.stringify(w.twDisplayVicinity_Options));
});
})(window,document);

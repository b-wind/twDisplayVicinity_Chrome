(function(w,d){
$().ready(function(){
	var	RADIO_KV_LIST = [
		{key:'USE_SEARCH_TL_BY_DEFAULT', val:false}
	,	{key:'FLG_TWITSPRITZ', val:false}
	];
	
	var	INT_KV_LIST = [
		{key:'HOUR_AFTER', val:8, min:0, max:null}
	];
	
	var	STR_KV_LIST = [
		{key:'LINK_TEXT'}
	,	{key:'ACT_LINK_TEXT'}
	,	{key:'TS_LINK_TEXT'}
	];
	for (var ci=0,len=STR_KV_LIST.length; ci<len; ci++) {
		var	str_kv = STR_KV_LIST[ci];
		str_kv.val = chrome.i18n.getMessage(str_kv.key);
	}
	
	$('.i18n').each(function(){
		var	jq_elm = $(this);
		var	text = chrome.i18n.getMessage(jq_elm.val()||jq_elm.html());
		if (!text) return;
		if (jq_elm.val()) jq_elm.val(text);
		else jq_elm.html(text);
	});
	
	$('form').submit(function(){
		return false;
	});
	
	var	set_radio_evt = function(kv){
		var	check_svalue = function(kv, svalue){
			if (svalue === '0' || svalue === 0 || svalue === false || svalue === 'false') return '0';
			if (svalue === '1' || svalue === 1 || svalue === true || svalue === 'true') return '1';
			return check_svalue(kv, kv.val);
		};
		var	key = kv.key;
		var	svalue = check_svalue(kv, localStorage[key]);
		
		var	jq_target = $('#'+key), jq_inputs = jq_target.find('input:radio');
		jq_inputs.each(function(){
			var	jq_input = $(this), val=jq_input.val();
			if (val === svalue) jq_input.attr('checked', 'checked');
		});
		jq_inputs.change(function(){
			var	jq_input = $(this);
			localStorage[key] = check_svalue(kv, jq_input.val());
		});
	};	//	end of set_radio_evt()
	
	var	set_int_evt = function(kv){
		var	check_svalue = function(kv, svalue){
			if (isNaN(svalue)) {
				svalue = kv.val;
			}
			else {
				svalue = parseInt(svalue);
				if ((kv.min !== null && svalue < kv.min) || (kv.max !== null && kv.max < svalue)) svalue = kv.val;
			}
			svalue += '';
			return svalue;
		};
		var	key = kv.key;
		var	svalue = check_svalue(kv, localStorage[key]);
		
		var	jq_target = $('#'+key), jq_input = jq_target.find('input:text:first'), jq_current = jq_target.find('span.current:first');
		jq_current.text(svalue);
		jq_input.val(svalue);
		
		jq_target.find('input:button').click(function(){
			var	svalue = check_svalue(kv, jq_input.val());
			localStorage[key] = svalue;
			jq_current.text(svalue);
			jq_input.val(svalue);
		});
		
	};	//	end of set_int_evt()
	
	var	set_str_evt = function(kv){
		var	check_svalue = function(kv, svalue){
			if (!svalue) {
				svalue = kv.val;
			}
			else {
				svalue = (''+svalue).replace(/(?:^\s+|\s+$)/g, '');
				if (!svalue) svalue = kv.val;
			}
			return svalue;
		};
		var	key = kv.key;
		var	svalue = check_svalue(kv, localStorage[key]);
		
		var	jq_target = $('#'+key), jq_input = jq_target.find('input:text:first'), jq_current = jq_target.find('span.current:first');
		jq_current.text(svalue);
		jq_input.val(svalue);
		
		jq_target.find('input:button').click(function(){
			var	svalue = check_svalue(kv, jq_input.val());
			localStorage[key] = svalue;
			jq_current.text(svalue);
			jq_input.val(svalue);
		});
		
	};	//	end of set_str_evt()
	
	var	set_all_evt = function(){
		for (var ci=0,leni=RADIO_KV_LIST.length; ci<leni; ci++) set_radio_evt(RADIO_KV_LIST[ci]);
		for (var ci=0,leni=INT_KV_LIST.length; ci<leni; ci++) set_int_evt(INT_KV_LIST[ci]);
		for (var ci=0,leni=STR_KV_LIST.length; ci<leni; ci++) set_str_evt(STR_KV_LIST[ci]);
	}	//	end of set_all_evt()
	
	set_all_evt();
	
	$('input[name="DEFAULT"]').click(function(){
		localStorage.clear();
		set_all_evt();
	});
	
});
})(window,document);

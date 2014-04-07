// ==UserScript==
// @name           twDisplayVicinity
// @namespace      http://d.hatena.ne.jp/furyu-tei
// @include        http://twitter.com/*
// @include        https://twitter.com/*
// @description    display the vicinity of a particular tweet on Twitter ver.0.01a
// ==/UserScript==
/*
  Download URL: 'http://furyu-tei.sakura.ne.jp/script/twDisplayVicinity.user.js'
  see also http://let.hatelabo.jp/furyu-tei/let/hLHVnMG9q-NH
*/
(function(w, d){
var main = function(w, d){
	//{ user parameters
	//var DEBUG = true;
	var DEBUG = false;
	
	var	DAY_BEFORE = 1;
	var	DAY_AFTER = 1;
	
	var	INTV_CHECK = 300;	// ms
	var	MAX_RETRY = 3;
	
	var	LINK_COLOR = 'darkblue';
	var	LINK_TEXT = '\u8fd1\u508d';	//	"近傍"
	var	LINK_TITLE = '\u8fd1\u8fba\u306e\u30c4\u30a4\u30fc\u30c8\u8868\u793a';	//	"近辺のツイート表示"
	
	var	FLG_TWITSPRITZ = true;
	var	TS_LINK_COLOR = 'darkgreen';
	var	TS_LINK_TEXT = 'TwitSpritz';
	var	TS_LINK_TITLE = 'TwitSpritz';
	//} end of user parameters
	
	
	//{ global variables
	var NAME_SCRIPT = 'twDisplayVicinity';
	var VER_SCRIPT = '0.01';
	//} end of global variables
	
	if (w[NAME_SCRIPT+'_touched']) return;
	
	if (!w.$) {var main = arguments.callee; setTimeout(function(){main(w,d);}, 100); return;}
	
	w[NAME_SCRIPT+'_touched'] = true;

	var $=w.$;
	
	var log_debug = (function(){
		if (DEBUG) {
			var jq_log_container = $('<textarea id="'+NAME_SCRIPT+'_log" style="width:100%; height:100px; background:lightblue; text-align:left; overflow-y:scroll" readonly></textarea>')
			$('div.global-nav').append(jq_log_container);
			$('div.global-nav').css('height', '140px');
		}
		return function(str){
			if (!DEBUG) return;
			jq_log_container.html(jq_log_container.html()+NAME_SCRIPT+' ['+new Date().toISOString()+'] '+str+'\n');
			jq_log_container.scrollTop(jq_log_container.prop('scrollHeight'));
		};
	})();	//	end of log_debug()
	
	log_debug('Initializing...');
	
	var	get_date_str = function(time_sec){
		var	dt = new Date(1000 * time_sec);
		return dt.getUTCFullYear() + '-' + (1 + dt.getUTCMonth()) + '-' + dt.getUTCDate();
	};	//	end of get_date_str()
	
	var	add_link_to_tweet = function(jq_tweet){
		if (0<jq_tweet.find('small.'+NAME_SCRIPT+'_link_container').size()) return;
		var	tweet_id = jq_tweet.attr('data-item-id'), screen_name = jq_tweet.attr('data-screen-name');
		if (!tweet_id || !screen_name) return;
		var	time_sec = parseInt(jq_tweet.find('span[data-time]:first').attr('data-time'));
		var	since = get_date_str(time_sec-3600*24*DAY_BEFORE), until = get_date_str(time_sec+3600*24*(1+DAY_AFTER));
		var	url_search = 'https://twitter.com/search?q='+encodeURIComponent('from:'+screen_name+' since:'+since+' until:'+until)+'&f=realtime';
		
		var	jq_link_container = $('<small class="'+NAME_SCRIPT+'_link_container"><a title="'+LINK_TITLE+'">'+LINK_TEXT+'</a></small>'), jq_link = jq_link_container.find('a:first');
		jq_link.attr('href', 'javascript:void(0)');
		jq_link.css({'color':LINK_COLOR, 'padding':'4px'});
		
		var	wait_cnt = MAX_RETRY;
		
		jq_link.click(function(){
			var	cwin = window.open(url_search);
			var	check = function(){
				var	$ = (function(){try{return cwin.$}catch(e){return null}})();
				if (!$) {
					setTimeout(check, INTV_CHECK);
					return;
				}
				var	jq_tweet_li = $("li[data-item-id='" + tweet_id + "']:first");
				if (jq_tweet_li.size() < 1) {
					$('body,html').animate({scrollTop: $('li[data-item-id]:last').offset().top}, '0');
					if ($('div.stream-end').is(':visible')) {
						wait_cnt--;
						if (wait_cnt <= 0) return;
					}
					setTimeout(check, INTV_CHECK);
					return;
				} 
				jq_tweet_li.css('background', 'gold');
				$('body,html').animate({scrollTop: jq_tweet_li.offset().top - $(cwin).height() / 2}, '0');
			};	//	end of check()
			check();
			return false;
		});
		
		jq_tweet.find('small.time:first').after(jq_link_container);
		jq_tweet.find('div.client-and-actions span.metadata:first').after(jq_link_container.clone(true));
		
		if (!FLG_TWITSPRITZ || !jq_tweet.parents('div.permalink-tweet-container')[0]) return;
		
		var	jq_ts_container = $('<small class="'+NAME_SCRIPT+'_ts_container"><a title="'+TS_LINK_TITLE+'">'+TS_LINK_TEXT+'</a></small>'), jq_ts_link = jq_ts_container.find('a:first');
		jq_ts_link.attr('href', 'javascript:void(0)');
		jq_ts_link.css({'color':TS_LINK_COLOR, 'padding':'4px'});
		
		jq_ts_link.click(function(){
			$.getScript('https://furyu-tei.sakura.ne.jp/ja_spritz/twit_spritz.js', function(){show_spritz()});
			return false;
		});
		jq_link_container.before(jq_ts_container);
		
	};	//	end of add_link_to_tweet()
	
	var	container_selector_list = [
		'ol.stream-items'
	,	'ol.recent-tweets'
	,	'div.permalink-tweet-container'
	];
	var	tweet_selector_list = [];
	for (var ci=0,len=container_selector_list.length; ci<len; ci++) tweet_selector_list[ci] = container_selector_list[ci] + ' div.tweet';
	var	tweet_selector = tweet_selector_list.join(',');
	
	$(tweet_selector).each(function(){
		add_link_to_tweet($(this));
	});
	
	/*
	//$(d).on('DOMNodeInserted', tweet_selector, function(){
	//	log_debug($(this).attr('class').replace(/\s+/g,' '));
	//	add_link_to_tweet($(this));
	//});
	*/
	$(d).bind('DOMNodeInserted', function(e){
		var	jq_target = $(e.target);
		(jq_target.hasClass('tweet')?jq_target:jq_target.find('div.tweet')).each(function(){
			add_link_to_tweet($(this));
		});
	});
	
	$('body,html').on('mouseover', tweet_selector, function(){
		add_link_to_tweet($(this));
	});
	
	log_debug('All set.');
	
}	//	end of main()

if (typeof w.$ == 'function') {
	main(w, d);
}
else {
	var container = d.documentElement;
	var script = d.createElement('script');
	script.textContent = '('+main.toString()+')(window, document);';
	container.appendChild(script);
}

})(window, document);

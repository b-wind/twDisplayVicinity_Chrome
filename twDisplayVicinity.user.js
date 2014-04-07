// ==UserScript==
// @name           twDisplayVicinity
// @namespace      http://d.hatena.ne.jp/furyu-tei
// @include        http://twitter.com/*
// @include        https://twitter.com/*
// @description    display the vicinity of a particular tweet on Twitter ver.0.01b1
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
	
	var	TARGET_TWEET_COLOR = 'gold';
	var	VICINITY_TWEET_COLOR = 'pink';
	
	var	LINK_COLOR = 'darkblue';
	var	LINK_TEXT = '\u8fd1\u508d';	//	"近傍"
	var	LINK_TITLE = '\u8fd1\u8fba\u306e\u30c4\u30a4\u30fc\u30c8\u8868\u793a';	//	"近辺のツイート表示"
	
	var	RT_LINK_COLOR = 'indigo';
	var	RT_LINK_TEXT = '\u76f4\u524d';	//	"直前"
	var	RT_LINK_TITLE = 'RT\u76f4\u524d\u306e\u30c4\u30a4\u30fc\u30c8\u8868\u793a';	//	"RT直前のツイート表示"
	
	var	FLG_TWITSPRITZ = true;
	var	TS_LINK_COLOR = 'darkgreen';
	var	TS_LINK_TEXT = 'TwitSpritz';
	var	TS_LINK_TITLE = 'TwitSpritz';
	//} end of user parameters
	
	
	//{ global variables
	var NAME_SCRIPT = 'twDisplayVicinity';
	var VER_SCRIPT = '0.01';
	var $=w.$;
	//} end of global variables
	
	//{ check environment
	if (w[NAME_SCRIPT+'_touched']) return;
	if (!$) {var main = arguments.callee; setTimeout(function(){main(w,d);}, 100); return;}
	w[NAME_SCRIPT+'_touched'] = true;
	//} end of check environment
	
	
	//{ functions
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
		
		jq_link.click(function(){
			var	wait_cnt = MAX_RETRY;
			var	cwin = window.open(url_search);
			var	check = function(){
				var	$ = (function(){try{return cwin.$}catch(e){return null}})();
				if (!$) {
					setTimeout(check, INTV_CHECK);
					return;
				}
				var	jq_tweet_li = $('li[data-item-id="' + tweet_id + '"]:first');
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
		
		var	retweet_id = jq_tweet.attr('data-retweet-id'), retweeter = jq_tweet.attr('data-retweeter');
		if (retweet_id && retweeter) {
			var	url_rt_search = 'https://twitter.com/search?q='+encodeURIComponent('from:'+retweeter+' max_id:'+retweet_id)+'&f=realtime';
			
			var	jq_rt_link_container = $('<small class="'+NAME_SCRIPT+'_rt_container"><a title="'+RT_LINK_TITLE+'">'+RT_LINK_TEXT+'</a></small>'), jq_rt_link = jq_rt_link_container.find('a:first');
			jq_rt_link.attr('href', 'javascript:void(0)');
			jq_rt_link.css({'color':RT_LINK_COLOR, 'padding':'4px'});
			
			jq_rt_link.click(function(){
				var	wait_cnt = MAX_RETRY;
				var	cwin = window.open(url_rt_search);
				var	check = function(){
					var	$ = (function(){try{return cwin.$}catch(e){return null}})();
					if (!$) {
						setTimeout(check, INTV_CHECK);
						return;
					}
					var	jq_tweet_li = $("li[data-item-id]:first");
					if (jq_tweet_li.size() < 1) {
						if ($('div.stream-end').is(':visible')) {
							wait_cnt--;
							if (wait_cnt <= 0) return;
						}
						setTimeout(check, INTV_CHECK);
						return;
					} 
					jq_tweet_li.css('background', VICINITY_TWEET_COLOR);
				};	//	end of check()
				check();
				return false;
			});
			jq_tweet.find('div.context:first').find('div.with-icn:first').append(jq_rt_link);
		}
		
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
	
	var	add_link_to_activity = function(jq_activity){
		if (0<jq_activity.find('small.'+NAME_SCRIPT+'_link_container').size()) return;
		var	jq_timestamp = jq_activity.find('div.activity-timestamp span[data-time]:first');
		if (jq_timestamp.size() < 1) return;
		var	time_sec = parseInt(jq_timestamp.attr('data-time'))
		var	since = get_date_str(time_sec-3600*24*DAY_BEFORE), until = get_date_str(time_sec+3600*24*(1+DAY_AFTER));
		var	min_sec = parseInt(jq_activity.attr('data-activity-min-position'))/1000, max_sec = parseInt(jq_activity.attr('data-activity-max-position'))/1000;
		
		log_debug('time:'+time_sec+'min:'+min_sec+'max:'+max_sec);
		
		jq_activity.find('ol.activity-supplement a.js-user-tipsy[data-user-id],a.js-action-profile-name').each(function(){
			var	jq_user_link = $(this);
			var	screen_name = jq_user_link.attr('href').replace(/^.*\//,'');
			var	url_search = 'https://twitter.com/search?q='+encodeURIComponent('from:'+screen_name+' since:'+since+' until:'+until)+'&f=realtime';
			
			var	jq_link_container = $('<small class="'+NAME_SCRIPT+'_link_container"><a title="'+LINK_TITLE+'">'+LINK_TEXT+'</a></small>'), jq_link = jq_link_container.find('a:first');
			jq_link.attr('href', 'javascript:void(0)');
			jq_link.css({'color':LINK_COLOR});
			
			jq_link.click(function(){
				var	wait_cnt = MAX_RETRY;
				var	cwin = window.open(url_search);
				var	check = function(){
					var	$ = (function(){try{return cwin.$}catch(e){return null}})();
					if (!$) {
						setTimeout(check, INTV_CHECK);
						return;
					}
					var	jq_activity_li=null;
					$('li:not(".'+NAME_SCRIPT+'_touched")[data-item-id]').each(function(){
						var	jq_li = $(this);
						jq_li.addClass(NAME_SCRIPT+'_touched');
						var	tmp_time_sec = parseInt(jq_li.find('div.tweet span[data-time]:first').attr('data-time'));
						if (!jq_activity_li && tmp_time_sec <= min_sec) jq_activity_li = jq_li;
					});
					if (!jq_activity_li) {
						$('body,html').animate({scrollTop: $('li[data-item-id]:last').offset().top}, '0');
						if ($('div.stream-end').is(':visible')) {
							wait_cnt--;
							if (wait_cnt <= 0) return;
						}
						setTimeout(check, INTV_CHECK);
						return;
					} 
					jq_activity_li.css('background', VICINITY_TWEET_COLOR);
					$('body,html').animate({scrollTop: jq_activity_li.offset().top - $(cwin).height() / 2}, '0');
				};	//	end of check()
				check();
				return false;
			});
			
			jq_user_link.after(jq_link_container);
		});
		
	};	//	end of add_link_to_activity()
	//} end of functions
	
	
	//{ main procedure
	log_debug('Initializing...');
	
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
	//var	activity_type_list = [
	//	'retweet', 'favorite', 'follow', 'retweeted_mention', 'favorited_mention', 'retweeted_retweet_activity'
	//];
	//var	activity_selector_list = [];
	//for (var ci=0,len=activity_type_list.length; ci<len; ci++) activity_selector_list[ci] = 'div.stream-item-activity-me[data-activity-type="'+activity_type_list[ci]+'"]';
	//var	activity_selector = activity_selector_list.join(',');
	*/
	var	activity_selector = 'div.stream-item-activity-me[data-activity-type]';
	$(activity_selector).each(function(){
		add_link_to_activity($(this));
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
		(jq_target.hasClass('stream-item-activity-me')?jq_target:jq_target.find(activity_selector)).each(function(){
			add_link_to_activity($(this));
		});
	});
	
	$('body,html').on('mouseover', tweet_selector, function(){
		add_link_to_tweet($(this));
	});
	
	log_debug('All set.');
	//} end of main procedure
	
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

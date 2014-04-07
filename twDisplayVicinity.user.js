// ==UserScript==
// @name           twDisplayVicinity
// @namespace      http://d.hatena.ne.jp/furyu-tei
// @include        http://twitter.com/*
// @include        https://twitter.com/*
// @description    display the vicinity of a particular tweet on Twitter ver.0.01b3
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
	var	LINK_TITLE = '\u8fd1\u508d\u30c4\u30a4\u30fc\u30c8\u8868\u793a';	//	"近傍ツイート表示"
	
	var	ACT_LINK_COLOR = 'indigo';
	var	ACT_LINK_TEXT = '\u8fd1\u508d';	//	"近傍"
	var	ACT_LINK_TITLE = '\u30a2\u30af\u30b7\u30e7\u30f3\u306e\u8fd1\u508d\u30c4\u30a4\u30fc\u30c8\u8868\u793a';	//	"アクションの近傍ツイート表示"
	
	var	FLG_TWITSPRITZ = true;
	var	TS_LINK_COLOR = 'darkgreen';
	var	TS_LINK_TEXT = 'TwitSpritz';
	var	TS_LINK_TITLE = 'TwitSpritz\x3a\x20Spritz\u3082\u3069\u304d\u8868\u793a';	//	"TwitSpritz: Spritzもどき表示"
	//} end of user parameters
	
	
	//{ global variables
	var NAME_SCRIPT = 'twDisplayVicinity';
	var VER_SCRIPT = '0.01';
	var $=w.$;
	
	//{ check environment
	if (w[NAME_SCRIPT+'_touched']) return;
	if (!$) {var main = arguments.callee; setTimeout(function(){main(w,d);}, 100); return;}
	w[NAME_SCRIPT+'_touched'] = true;
	//} end of check environment
	
	var	API_SEARCH = 'https://twitter.com/search';
	var	FNAME_ON_CLICK = NAME_SCRIPT+'_click_link';
	var	LINK_ID_PREFIX = NAME_SCRIPT+'_link_';
	
	var	LINK_CONTAINER_CLASS = NAME_SCRIPT+'_link_container';
	var	ACT_CONTAINER_CLASS = NAME_SCRIPT+'_act_container';
	var	TS_CONTAINER_CLASS = NAME_SCRIPT+'_ts_container';
	
	var	CONTAINER_CLASS_LIST = [LINK_CONTAINER_CLASS, ACT_CONTAINER_CLASS, TS_CONTAINER_CLASS];
	
	var	LINK_DICT = {};
	var	LINK_ID_NUM = 1;
	//} end of global variables
	
	
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
	
	var	wopen = function(url, cwin){
		if (cwin) {cwin.location.href = url} else {cwin = w.open(url)}
		return cwin;
	};	//	end of wopen
	
	var	get_search_url = function(query){
		return API_SEARCH+'?q='+encodeURIComponent(query)+'&f=realtime';
	};	//	end of get_search_url()
	
	w[FNAME_ON_CLICK] = function(link){
		log_debug('clicked: link.id='+link.id);
		var	onclick = LINK_DICT[link.id];
		if (onclick) onclick();
		return false;
	};	//	end of _click_link()
	
	var	set_link_to_click = function(jq_link, onclick){
		var	link_id = LINK_ID_PREFIX+(LINK_ID_NUM++);
		jq_link.attr('id', link_id);
		LINK_DICT[link_id] = onclick;
		//jq_link.click(onclick);
		jq_link.attr('onclick', 'javascript:return '+FNAME_ON_CLICK+'(this)');
		//	jq_link.click(onclick) だと、ツイートを「開く」→「閉じる」した後等にonclickがコールされなくなってしまう(Twitter側のスクリプトでイベントを無効化している？)
	};	//	end of set_link_to_click()
	
	var	get_tweet_li_clone_for_cwin = (function(){
		var	selector_list = [];
		for (var ci=0,len=CONTAINER_CLASS_LIST.length; ci<len; ci++) selector_list[ci] = 'small.'+CONTAINER_CLASS_LIST[ci];
		var	selector = selector_list.join(',');
		return function(jq_tweet_li){
			if (jq_tweet_li[0].tagName != 'LI') jq_tweet_li = jq_tweet_li.parents('li:first');
			var	jq_li_clone = jq_tweet_li.clone(true);
			jq_li_clone.find(selector).each(function(){
				$(this).remove();
				log_debug('removed: '+this.className);
			});
			return jq_li_clone;
		};
	})();	//	end of get_tweet_li_clone_for_cwin()
	
	var	add_link_to_tweet = function(jq_tweet){
		if (0<jq_tweet.find('small.'+LINK_CONTAINER_CLASS).size()) return;
		var	tweet_id = jq_tweet.attr('data-item-id'), screen_name = jq_tweet.attr('data-screen-name');
		if (!tweet_id || !screen_name) return;
		var	time_sec = parseInt(jq_tweet.find('span[data-time]:first').attr('data-time'));
		var	since = get_date_str(time_sec-3600*24*DAY_BEFORE), until = get_date_str(time_sec+3600*24*(1+DAY_AFTER));
		var	url_search = get_search_url('from:'+screen_name+' since:'+since+' until:'+until);
		
		var	jq_link_container = $('<small class="'+LINK_CONTAINER_CLASS+'"><a title="'+LINK_TITLE+'">'+LINK_TEXT+'</a></small>'), jq_link = jq_link_container.find('a:first');
		jq_link.attr('href', url_search);
		jq_link.css({'color':LINK_COLOR, 'padding':'4px'});
		
		var	tweet_search_by_id = function(url_search, tweet_id, cwin, target_color, jq_tweet_li_target){
			cwin = wopen(url_search, cwin);
			if (!target_color) target_color = TARGET_TWEET_COLOR;
			var	wait_cnt = MAX_RETRY;
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
						if (wait_cnt <= 0) {
							if (!jq_tweet_li_target) return;
							var	jq_tweet_li_target_clone = get_tweet_li_clone_for_cwin(jq_tweet_li_target);
							try{
								$('li[data-item-id]:last').after(jq_tweet_li_target_clone);
								jq_tweet_li_target_clone.css('background', target_color);
							}catch(e){}
							return;
						}
					}
					setTimeout(check, INTV_CHECK);
					return;
				} 
				if (jq_tweet_li_target) {
					var	jq_tweet_li_target_clone = get_tweet_li_clone_for_cwin(jq_tweet_li_target);
					try{
						jq_tweet_li.before(jq_tweet_li_target_clone);
						jq_tweet_li = jq_tweet_li_target_clone;
					}catch(e){}
				}
				jq_tweet_li.css('background', target_color);
				$('body,html').animate({scrollTop: jq_tweet_li.offset().top - $(cwin).height() / 2}, '0');
			};	//	end of check()
			check();
		};	//	end of tweet_search_by_id()
		
		set_link_to_click(jq_link, function(){
			tweet_search_by_id(url_search, tweet_id);
			return false;
		});
		
		jq_tweet.find('small.time:first').after(jq_link_container);
		jq_tweet.find('div.client-and-actions span.metadata:first').after(jq_link_container.clone(true));
		
		var	retweet_id = jq_tweet.attr('data-retweet-id'), retweeter = jq_tweet.attr('data-retweeter');
		if (retweet_id && retweeter) {
			var	url_rt_search = get_search_url('from:'+retweeter+' max_id:'+retweet_id);
			
			var	jq_rt_link_container = $('<small class="'+ACT_CONTAINER_CLASS+'"><a title="'+ACT_LINK_TITLE+'">'+ACT_LINK_TEXT+'</a></small>'), jq_rt_link = jq_rt_link_container.find('a:first');
			jq_rt_link.attr('href', url_rt_search);
			jq_rt_link.css({'color':ACT_LINK_COLOR, 'padding':'4px'});
			
			set_link_to_click(jq_rt_link, function(){
				var	cwin = wopen('about:blank');
				var	callback = function(html){
					log_debug('callback');
					for (;;) {
						if (html.match(/<li\s*class="[\s\S]*?stream-item[\s\S]*?data-item-id="(\d+)"/i)) {
							var	tweet_id = RegExp.$1;
							log_debug('tweet_id='+tweet_id);
							if (html.match(/<span\s*class="[\s\S]*?_timestamp[\s\S]*?\s*data-time="(\d+)"/i)) {
								var	time_sec = parseInt(RegExp.$1);
								log_debug('time_sec='+time_sec);
								var	since = get_date_str(time_sec-3600*24*DAY_BEFORE), until = get_date_str(time_sec+3600*24*(1+DAY_AFTER));
								var	url_search = get_search_url('from:'+retweeter+' since:'+since+' until:'+until);
								jq_rt_link.attr('href', url_search);
								var	click = function(cwin){
									tweet_search_by_id(url_search, tweet_id, cwin, VICINITY_TWEET_COLOR, jq_tweet);
									return false;
								};	//	end of click()
								break;
							}
						}
						var	click = function(cwin){
							var	wait_cnt = MAX_RETRY;
							cwin = wopen(url_rt_search, cwin);
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
								var	jq_tweet_li_target_clone = get_tweet_li_clone_for_cwin(jq_tweet);
								try{
									jq_tweet_li.before(jq_tweet_li_target_clone);
									jq_tweet_li = jq_tweet_li_target_clone;
								}catch(e){}
								jq_tweet_li.css('background', VICINITY_TWEET_COLOR);
							};	//	end of check()
							check();
							return false;
						};	//	end of click()
						break;
					}
					var	jq_rt_link2 = jq_rt_link.clone();
					set_link_to_click(jq_rt_link2, function(){click(cwin)});
					jq_rt_link.after(jq_rt_link2);
					jq_rt_link.remove();
					//jq_rt_link2.click();
					click(cwin);
					cwin = null;
				};	//	end of callback()
				
				//$.ajax({url:url_rt_search, success:callback, dataType:'html'});
				$.get(url_rt_search, callback, 'html');
				
				return false;
			});
			jq_tweet.find('div.context:first').find('div.with-icn:first').append(jq_rt_link_container);
		}
		
		if (!FLG_TWITSPRITZ || !jq_tweet.parents('div.permalink-tweet-container')[0]) return;
		
		var	jq_ts_container = $('<small class="'+TS_CONTAINER_CLASS+'"><a title="'+TS_LINK_TITLE+'">'+TS_LINK_TEXT+'</a></small>'), jq_ts_link = jq_ts_container.find('a:first');
		jq_ts_link.css({'color':TS_LINK_COLOR, 'padding':'4px'});
		
		set_link_to_click(jq_ts_link, function(){
			$.getScript('https://furyu-tei.sakura.ne.jp/ja_spritz/twit_spritz.js', function(){show_spritz()});
			return false;
		});
		jq_link_container.before(jq_ts_container);
		
	};	//	end of add_link_to_tweet()
	
	var	add_link_to_activity = function(jq_activity){
		if (0<jq_activity.find('small.'+ACT_CONTAINER_CLASS).size()) return;
		var	jq_timestamp = jq_activity.find('div.activity-timestamp span[data-time]:first');
		if (jq_timestamp.size() < 1) return;
		var	time_sec = parseInt(jq_timestamp.attr('data-time'))
		var	since = get_date_str(time_sec-3600*24*DAY_BEFORE), until = get_date_str(time_sec+3600*24*(1+DAY_AFTER));
		var	min_sec = parseInt(jq_activity.attr('data-activity-min-position'))/1000, max_sec = parseInt(jq_activity.attr('data-activity-max-position'))/1000;
		
		log_debug('add_link_to_activity() time:'+time_sec+'min:'+min_sec+'max:'+max_sec);
		
		jq_activity.find('ol.activity-supplement a.js-user-tipsy[data-user-id],a.js-action-profile-name').each(function(){
			var	jq_user_link = $(this);
			var	screen_name = jq_user_link.attr('href').replace(/^.*\//,'');
			var	url_search = get_search_url('from:'+screen_name+' since:'+since+' until:'+until);
			
			var	jq_link_container = $('<small class="'+ACT_CONTAINER_CLASS+'"><a title="'+ACT_LINK_TITLE+'">'+ACT_LINK_TEXT+'</a></small>'), jq_link = jq_link_container.find('a:first');
			jq_link.attr('href', url_search);
			jq_link.css({'color':ACT_LINK_COLOR});
			
			set_link_to_click(jq_link, function(){
				var	wait_cnt = MAX_RETRY;
				var	cwin = wopen(url_search);
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
							if (wait_cnt <= 0) {
								var	jq_activity_li_target_clone = get_tweet_li_clone_for_cwin(jq_activity);
								try{
									$('li[data-item-id]:last').after(jq_activity_li_target_clone);
									jq_activity_li_target_clone.css('background', VICINITY_TWEET_COLOR);
								}catch(e){}
								return;
							}
						}
						setTimeout(check, INTV_CHECK);
						return;
					}
					var	jq_activity_li_target_clone = get_tweet_li_clone_for_cwin(jq_activity);
					try{
						jq_activity_li.before(jq_activity_li_target_clone);
						jq_activity_li = jq_activity_li_target_clone;
					}catch(e){}
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
